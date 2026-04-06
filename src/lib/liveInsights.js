import { compareEventOrder, shotPoints } from './score.js';
import {
  MIN_KICKOUT_PATTERN_SAMPLE,
  MIN_LANE_SAMPLE,
  MIN_PHASE_SAMPLE,
  MIN_RECENT_SAMPLE,
  MIN_RECOMMENDATION_SAMPLE,
  MIN_SIDE_SAMPLE,
  dominantShare,
  hasMinimumSample,
  meaningfulCountGap,
  meaningfulGap,
  pct,
} from './thresholds.js';
import { kickoutOutcomeSideOf } from './kickoutOutcome.js';

const POSITIVE_KICKOUT_OUTCOMES = new Set(['retained', 'score', 'won']);
const SCORE_OUTCOMES = new Set(['goal', 'point', 'two point', 'two-point']);

const SIDE_LABELS = {
  left: 'left',
  centre: 'centre',
  right: 'right',
};

const DEPTH_LABELS = {
  short: 'short',
  medium: 'medium',
  long: 'long',
  'very long': 'very long',
};

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function eventType(event) {
  return String(event?.event_type || 'kickout').trim().toLowerCase() || 'kickout';
}

function direction(event) {
  const value = String(event?.direction || 'ours').trim().toLowerCase() || 'ours';
  return value === 'theirs' ? 'theirs' : 'ours';
}

function pronoun(side) {
  return side === 'ours' ? 'We' : 'They';
}

function pronounLower(side) {
  return side === 'ours' ? 'we' : 'they';
}

function sideLabel(event) {
  return SIDE_LABELS[norm(event?.side_band)] || 'centre';
}

function depthLabel(event) {
  return DEPTH_LABELS[norm(event?.depth_band)] || 'medium';
}

function laneLabel(event) {
  return `${sideLabel(event)}-${depthLabel(event)}`;
}

function channelLabel(event) {
  return `${sideLabel(event)} channel`;
}

function parseClockMinutes(clock) {
  const match = String(clock || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) + Number.parseInt(match[2], 10) / 60;
}

function periodBase(period) {
  if (period === 'H2') return 40;
  if (period === 'ET') return 80;
  return 0;
}

function absoluteMinute(event) {
  const minutes = parseClockMinutes(event?.clock);
  if (minutes == null) return null;
  return periodBase(String(event?.period || 'H1')) + minutes;
}

function phaseFromRatio(ratio) {
  if (ratio < 1 / 3) return 'early';
  if (ratio < 2 / 3) return 'middle';
  return 'late';
}

function buildPositionResolver(items) {
  const minutes = items
    .map((item) => item.minute)
    .filter((value) => Number.isFinite(value));

  if (minutes.length >= Math.max(2, Math.ceil(items.length / 2))) {
    const min = Math.min(...minutes);
    const max = Math.max(...minutes);
    if (max > min) {
      return {
        usesClock: true,
        positionFor: (item, index) => (
          Number.isFinite(item.minute)
            ? (item.minute - min) / (max - min)
            : (items.length === 1 ? 1 : index / (items.length - 1))
        ),
      };
    }
  }

  return {
    usesClock: false,
    positionFor: (_item, index) => (items.length === 1 ? 1 : index / (items.length - 1)),
  };
}

function isPositiveKickout(event) {
  return kickoutOutcomeSideOf(event) === 'selected' || POSITIVE_KICKOUT_OUTCOMES.has(norm(event?.outcome));
}

function isScoreEvent(event) {
  return eventType(event) === 'shot' && SCORE_OUTCOMES.has(norm(event?.outcome));
}

function kickoutController(event) {
  if (eventType(event) !== 'kickout') return null;
  const positive = isPositiveKickout(event);
  if (direction(event) === 'ours') return positive ? 'ours' : 'theirs';
  return positive ? 'theirs' : 'ours';
}

function sortEvents(events = []) {
  return [...events].sort(compareEventOrder);
}

function summarizeControllerWindow(items) {
  if (items.length < MIN_RECENT_SAMPLE) {
    return { line: 'Not enough kickout data yet.', tone: 'neutral' };
  }

  const controllers = items.map((item) => item.controller);
  const ours = controllers.filter((side) => side === 'ours').length;
  const theirs = controllers.length - ours;
  const leader = ours > theirs ? 'ours' : theirs > ours ? 'theirs' : 'level';

  let streak = 1;
  for (let index = controllers.length - 1; index > 0; index -= 1) {
    if (controllers[index] !== controllers[index - 1]) break;
    streak += 1;
  }

  if (leader !== 'level' && streak >= 3) {
    return {
      line: `${pronoun(controllers.at(-1))} have won the last ${streak} kickout battles.`,
      tone: controllers.at(-1) === 'ours' ? 'positive' : 'negative',
    };
  }

  if (leader !== 'level' && meaningfulCountGap(ours, theirs, 2)) {
    const wins = leader === 'ours' ? ours : theirs;
    return {
      line: `${pronoun(leader)} have won ${wins} of the last ${items.length} kickout battles.`,
      tone: leader === 'ours' ? 'positive' : 'negative',
    };
  }

  return { line: 'Kickout battle is balanced recently.', tone: 'neutral' };
}

function summarizeScoreWindow(items) {
  if (items.length < MIN_RECENT_SAMPLE) {
    return { line: 'Not enough scoring data yet.', tone: 'neutral' };
  }

  let streak = 1;
  for (let index = items.length - 1; index > 0; index -= 1) {
    if (items[index].team !== items[index - 1].team) break;
    streak += 1;
  }

  if (streak >= 3) {
    const team = items.at(-1)?.team || 'ours';
    return {
      line: `${pronoun(team)} have the last ${streak} scores.`,
      tone: team === 'ours' ? 'positive' : 'negative',
    };
  }

  const totals = items.reduce(
    (acc, item) => {
      acc[item.team] += item.points;
      return acc;
    },
    { ours: 0, theirs: 0 },
  );
  const totalPoints = totals.ours + totals.theirs;
  const leader = totals.ours > totals.theirs ? 'ours' : totals.theirs > totals.ours ? 'theirs' : 'level';

  if (leader !== 'level' && totalPoints >= 4 && meaningfulCountGap(totals.ours, totals.theirs, 3)) {
    return {
      line: `${pronoun(leader)} have ${totals[leader]} of the last ${totalPoints} points.`,
      tone: leader === 'ours' ? 'positive' : 'negative',
    };
  }

  return { line: 'Recent scoring is balanced.', tone: 'neutral' };
}

function phaseBuckets(items, metricKey, resolver) {
  if (!hasMinimumSample(items.length, MIN_PHASE_SAMPLE)) return null;

  const phases = [
    { key: 'early', label: 'early', ours: 0, theirs: 0 },
    { key: 'middle', label: 'middle', ours: 0, theirs: 0 },
    { key: 'late', label: 'late', ours: 0, theirs: 0 },
  ];

  const positionFor = resolver.positionFor;

  items.forEach((item, index) => {
    const phase = phases.find((candidate) => candidate.key === phaseFromRatio(positionFor(item, index)));
    phase[item.team] += item[metricKey];
  });

  return {
    usesClock: resolver.usesClock,
    phases: phases.map((phase) => {
      const diff = phase.ours - phase.theirs;
      let leader = 'level';
      if (diff >= 2) leader = 'ours';
      else if (diff <= -2) leader = 'theirs';
      return { ...phase, leader, diff };
    }),
  };
}

function longestRun(items, metricKey, resolver) {
  if (!items.length) return null;

  let best = null;
  let current = null;
  const positionFor = resolver.positionFor;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const phase = phaseFromRatio(positionFor(item, index));

    if (!current || current.team !== item.team) {
      current = {
        team: item.team,
        count: 1,
        total: item[metricKey],
        phase,
        usesClock: resolver.usesClock,
      };
    } else {
      current.count += 1;
      current.total += item[metricKey];
      current.phase = phase;
      current.usesClock = resolver.usesClock;
    }

    if (
      !best ||
      current.total > best.total ||
      (current.total === best.total && current.count > best.count)
    ) {
      best = { ...current };
    }
  }

  return best;
}

function buildFlowNarratives(scoreItems, kickoutItems) {
  const scoreLines = [];
  const kickoutLines = [];

  const scoreResolver = buildPositionResolver(scoreItems);
  const kickoutResolver = buildPositionResolver(kickoutItems);
  const scorePhaseState = phaseBuckets(scoreItems, 'points', scoreResolver);
  const scoreRun = longestRun(scoreItems, 'points', scoreResolver);
  const kickoutPhaseState = phaseBuckets(kickoutItems, 'value', kickoutResolver);
  const kickoutRun = longestRun(kickoutItems, 'value', kickoutResolver);
  const scorePhases = scorePhaseState?.phases || null;
  const kickoutPhases = kickoutPhaseState?.phases || null;

  if (scoreRun && scoreRun.total >= 5) {
    if (scoreRun.usesClock) {
      scoreLines.push(`${pronoun(scoreRun.team)} hit the biggest scoring run ${scoreRun.phase} (${scoreRun.total} unanswered points).`);
    } else {
      scoreLines.push(`${pronoun(scoreRun.team)} had the biggest scoring run (${scoreRun.total} unanswered points).`);
    }
  }

  if (scorePhases && scorePhaseState?.usesClock) {
    const early = scorePhases[0]?.leader;
    const late = scorePhases[2]?.leader;
    const middle = scorePhases[1]?.leader;

    if (early !== 'level' && late !== 'level' && early !== late) {
      scoreLines.push(`${pronoun(early)} started stronger, but ${pronounLower(late)} finished the phase better.`);
    } else if (middle !== 'level' && middle !== early && middle !== late) {
      scoreLines.push(`${pronoun(middle)} controlled the middle scoring phase.`);
    }
  }

  if (kickoutRun && kickoutRun.count >= 3) {
    if (kickoutRun.usesClock) {
      kickoutLines.push(`${pronoun(kickoutRun.team)} had the longest kickout spell ${kickoutRun.phase} (${kickoutRun.count} in a row).`);
    } else {
      kickoutLines.push(`${pronoun(kickoutRun.team)} had the longest kickout spell (${kickoutRun.count} in a row).`);
    }
  }

  if (kickoutPhases && kickoutPhaseState?.usesClock) {
    const early = kickoutPhases[0]?.leader;
    const late = kickoutPhases[2]?.leader;
    const middle = kickoutPhases[1]?.leader;

    if (early !== 'level' && late !== 'level' && early !== late) {
      kickoutLines.push(`Kickout control flipped from ${pronounLower(early)} early to ${pronounLower(late)} late.`);
    } else if (middle !== 'level' && middle !== early && middle !== late) {
      kickoutLines.push(`${pronoun(middle)} controlled the middle kickout phase.`);
    }
  }

  return {
    lines: [...scoreLines, ...kickoutLines].slice(0, 3),
    coachLines: [...kickoutLines, ...scoreLines].slice(0, 2),
    hasClockConfidence: Boolean(scorePhaseState?.usesClock || kickoutPhaseState?.usesClock),
  };
}

function aggregateBy(items, keyFn, seedFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, seedFn(item));
    const value = map.get(key);
    value.total += 1;
    if (value.win != null) value.win += item.win ? 1 : 0;
    if (value.points != null) value.points += item.points || 0;
    if (value.chances != null) value.chances += item.chances || 0;
  }
  return [...map.values()];
}

function topBy(list, field = 'total') {
  return [...list].sort((a, b) => b[field] - a[field])[0] || null;
}

function buildKickoutPattern(events) {
  const theirKickouts = sortEvents(events.filter((event) => eventType(event) === 'kickout' && direction(event) === 'theirs'));
  if (!theirKickouts.length) {
    return {
      total: 0,
      primaryTarget: null,
      primaryLane: null,
      line: 'No opposition kickouts logged yet.',
      trendLine: null,
    };
  }

  const targetEntries = aggregateBy(
    theirKickouts.filter((event) => event.target_player),
    (event) => event.target_player,
    (event) => ({ key: event.target_player, label: `#${event.target_player}`, total: 0 }),
  );
  const winningTargetEntries = aggregateBy(
    theirKickouts.filter((event) => event.target_player && isPositiveKickout(event)),
    (event) => event.target_player,
    (event) => ({ key: event.target_player, label: `#${event.target_player}`, total: 0 }),
  );
  const laneEntries = aggregateBy(
    theirKickouts,
    (event) => laneLabel(event),
    (event) => ({ key: laneLabel(event), label: laneLabel(event), total: 0 }),
  );

  const primaryTarget = topBy(targetEntries);
  const primaryWinner = topBy(winningTargetEntries);
  const primaryLane = topBy(laneEntries);
  const wonKickouts = theirKickouts.filter((event) => isPositiveKickout(event));

  const recentKickouts = theirKickouts.slice(-4);
  const recentLaneEntries = aggregateBy(
    recentKickouts,
    (event) => laneLabel(event),
    (event) => ({ key: laneLabel(event), label: laneLabel(event), total: 0 }),
  );
  const recentLane = topBy(recentLaneEntries);

  let line = 'No clear opposition kickout pattern yet.';
  if (
    primaryWinner &&
    hasMinimumSample(wonKickouts.length, 4) &&
    dominantShare(primaryWinner.total, wonKickouts.length, 0.5, 3)
  ) {
    line = `${primaryWinner.label} is their main kickout target so far (${primaryWinner.total} of ${wonKickouts.length} kickouts won).`;
  } else if (
    primaryTarget &&
    dominantShare(primaryTarget.total, theirKickouts.length, 0.45, 3)
  ) {
    line = `${primaryTarget.label} is their most targeted kickout option so far (${primaryTarget.total} of ${theirKickouts.length}).`;
  } else if (
    primaryLane &&
    dominantShare(primaryLane.total, theirKickouts.length, 0.45, 3)
  ) {
    line = `${primaryLane.label} is their most-used kickout lane so far (${primaryLane.total} of ${theirKickouts.length}).`;
  }

  let trendLine = null;
  if (
    hasMinimumSample(recentKickouts.length, 3) &&
    recentLane &&
    primaryLane &&
    recentLane.key !== primaryLane.key &&
    dominantShare(recentLane.total, recentKickouts.length, 0.5, 2)
  ) {
    trendLine = `Recent shift towards ${recentLane.label}.`;
  }

  return {
    total: theirKickouts.length,
    wonTotal: wonKickouts.length,
    primaryWinner: primaryWinner && hasMinimumSample(wonKickouts.length, 4) && dominantShare(primaryWinner.total, wonKickouts.length, 0.5, 3)
      ? { ...primaryWinner, pct: pct(primaryWinner.total, wonKickouts.length) }
      : null,
    primaryTarget: primaryTarget && dominantShare(primaryTarget.total, theirKickouts.length, 0.45, 3)
      ? { ...primaryTarget, pct: pct(primaryTarget.total, theirKickouts.length) }
      : null,
    primaryLane: primaryLane && dominantShare(primaryLane.total, theirKickouts.length, 0.45, 3)
      ? { ...primaryLane, pct: pct(primaryLane.total, theirKickouts.length) }
      : null,
    line,
    trendLine,
  };
}

function buildKickoutPerformance(events) {
  const ourKickouts = sortEvents(events.filter((event) => eventType(event) === 'kickout' && direction(event) === 'ours'));
  if (!ourKickouts.length) {
    return {
      total: 0,
      bestLane: null,
      worstLane: null,
      line: 'No kickout performance data yet.',
      recentWarning: null,
      laneStats: [],
    };
  }

  const laneStats = aggregateBy(
    ourKickouts.map((event) => ({ ...event, win: isPositiveKickout(event) })),
    (event) => laneLabel(event),
    (event) => ({
      key: laneLabel(event),
      label: laneLabel(event),
      total: 0,
      win: 0,
    }),
  )
    .map((entry) => ({ ...entry, pct: pct(entry.win, entry.total) }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total);

  const validLanes = laneStats.filter((entry) => hasMinimumSample(entry.total, MIN_LANE_SAMPLE));
  const bestLane = validLanes[0] || null;
  const worstLane = validLanes[validLanes.length - 1] || null;

  let line = 'Kickout lanes are still settling.';
  if (bestLane && worstLane && bestLane.key !== worstLane.key && meaningfulGap(bestLane.pct, worstLane.pct, 20)) {
    line = `Best lane is ${bestLane.label} (${bestLane.pct}%). Weakest lane is ${worstLane.label} (${worstLane.pct}%).`;
  } else if (bestLane) {
    line = `${bestLane.label} is currently our steadiest restart lane (${bestLane.pct}%).`;
  }

  const recentOwnKickouts = ourKickouts.slice(-4);
  const recentByLane = aggregateBy(
    recentOwnKickouts.map((event) => ({ ...event, win: isPositiveKickout(event) })),
    (event) => laneLabel(event),
    (event) => ({ key: laneLabel(event), label: laneLabel(event), total: 0, win: 0 }),
  )
    .map((entry) => ({ ...entry, pct: pct(entry.win, entry.total) }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total);

  const recentProblem = recentByLane.find((entry) => entry.total >= 2 && entry.pct <= 33);
  const recentWarning = recentProblem
    ? `Recent problem: ${recentProblem.label} has failed on ${recentProblem.total - recentProblem.win} of its last ${recentProblem.total} uses.`
    : null;

  return {
    total: ourKickouts.length,
    bestLane,
    worstLane,
    line,
    recentWarning,
    laneStats: laneStats.slice(0, 4),
  };
}

function buildThreatMap(events) {
  const theirShots = sortEvents(events.filter((event) => eventType(event) === 'shot' && direction(event) === 'theirs'));
  if (!theirShots.length) {
    return {
      line: 'No opposition shooting data yet.',
      mainThreat: null,
      channelThreat: null,
      secondaryThreat: null,
    };
  }

  const playerMap = new Map();
  const channelMap = new Map();

  for (const shot of theirShots) {
    const player = shot.target_player || 'unknown';
    const points = shotPoints(shot);
    const chances = 1;
    const playerKey = player;
    if (!playerMap.has(playerKey)) {
      playerMap.set(playerKey, {
        key: playerKey,
        label: player === 'unknown' ? 'Pattern threat' : `#${player}`,
        total: 0,
        points: 0,
        chances: 0,
      });
    }
    const playerEntry = playerMap.get(playerKey);
    playerEntry.total += points > 0 ? 1 : 0;
    playerEntry.points += points;
    playerEntry.chances += chances;

    const channelKey = sideLabel(shot);
    if (!channelMap.has(channelKey)) {
      channelMap.set(channelKey, {
        key: channelKey,
        label: `${channelKey} channel`,
        total: 0,
        points: 0,
        chances: 0,
      });
    }
    const channelEntry = channelMap.get(channelKey);
    channelEntry.total += points > 0 ? 1 : 0;
    channelEntry.points += points;
    channelEntry.chances += chances;
  }

  const players = [...playerMap.values()].sort((a, b) => b.points - a.points || b.chances - a.chances);
  const channels = [...channelMap.values()].sort((a, b) => b.points - a.points || b.chances - a.chances);
  const topPlayer = players.find((player) => player.key !== 'unknown') || null;
  const secondaryThreat = players.filter((player) => player.key !== 'unknown')[1] || null;
  const topChannel = channels[0] || null;

  let line = 'Opposition shooting is spread evenly.';
  if (topPlayer && (topPlayer.points >= 3 || dominantShare(topPlayer.points, players.reduce((sum, item) => sum + item.points, 0), 0.4, 3))) {
    line = `${topPlayer.label} is their main scoring threat (${topPlayer.points} points, ${topPlayer.chances} chances).`;
  } else if (topChannel && dominantShare(topChannel.chances, theirShots.length, 0.45, 3)) {
    line = `Most of their danger is coming through the ${topChannel.label}.`;
  }

  return {
    line,
    mainThreat: topPlayer && topPlayer.key !== 'unknown' ? topPlayer : null,
    channelThreat: topChannel && dominantShare(topChannel.chances, theirShots.length, 0.45, 3) ? topChannel : null,
    secondaryThreat: secondaryThreat && secondaryThreat.points >= 2 ? secondaryThreat : null,
  };
}

function buildOpportunity(events, kickoutPerformance) {
  const ourShots = sortEvents(events.filter((event) => eventType(event) === 'shot' && direction(event) === 'ours'));
  const sideMap = new Map();

  for (const shot of ourShots) {
    const side = sideLabel(shot);
    if (!sideMap.has(side)) {
      sideMap.set(side, { key: side, label: `${side} channel`, total: 0, points: 0, chances: 0 });
    }
    const entry = sideMap.get(side);
    entry.total += shotPoints(shot) > 0 ? 1 : 0;
    entry.points += shotPoints(shot);
    entry.chances += 1;
  }

  const sides = [...sideMap.values()].sort((a, b) => b.points - a.points || b.chances - a.chances);
  const bestSide = sides[0] || null;

  if (bestSide && dominantShare(bestSide.chances, ourShots.length, 0.45, MIN_SIDE_SAMPLE)) {
    return {
      line: `${bestSide.label} is our best attacking route so far.`,
      bestSide,
      bestLane: null,
      keepDoing: `Keep using the ${bestSide.label}; it is giving us our best attacks.`,
    };
  }

  if (kickoutPerformance.bestLane && kickoutPerformance.bestLane.pct >= 60) {
    return {
      line: `${kickoutPerformance.bestLane.label} is our strongest restart lane so far.`,
      bestSide: null,
      bestLane: kickoutPerformance.bestLane,
      keepDoing: `Keep using ${kickoutPerformance.bestLane.label}; it is our cleanest restart route.`,
    };
  }

  return {
    line: 'No single attacking edge stands out yet.',
    bestSide: null,
    bestLane: null,
    keepDoing: null,
  };
}

function buildRecommendations(context) {
  const items = [];

  if (
    context.threat.mainThreat &&
    (
      (hasMinimumSample(context.threat.mainThreat.chances, MIN_RECOMMENDATION_SAMPLE) &&
        context.threat.mainThreat.points >= 3) ||
      context.threat.mainThreat.points >= 4
    )
  ) {
    items.push({
      type: 'tight_mark_player',
      title: `Tight mark ${context.threat.mainThreat.label}`,
      reason: `${context.threat.mainThreat.label} has ${context.threat.mainThreat.points} points from ${context.threat.mainThreat.chances} chances.`,
      priority: 1,
    });
  }

  if (context.kickoutPattern.primaryWinner) {
    items.push({
      type: 'press_kickout_target',
      title: `Press ${context.kickoutPattern.primaryWinner.label} on their kickouts`,
      reason: `${context.kickoutPattern.primaryWinner.label} has won ${context.kickoutPattern.primaryWinner.total} of their ${context.kickoutPattern.wonTotal} kickouts.`,
      priority: 2,
    });
  } else if (context.kickoutPattern.primaryTarget) {
    items.push({
      type: 'press_kickout_target',
      title: `Press ${context.kickoutPattern.primaryTarget.label} on their kickouts`,
      reason: `${context.kickoutPattern.primaryTarget.label} has been targeted on ${context.kickoutPattern.primaryTarget.total} of ${context.kickoutPattern.total} opposition restarts.`,
      priority: 2,
    });
  } else if (context.kickoutPattern.primaryLane) {
    items.push({
      type: 'press_kickout_lane',
      title: `Protect ${context.kickoutPattern.primaryLane.label} on their restarts`,
      reason: `${context.kickoutPattern.primaryLane.label} is their main kickout lane (${context.kickoutPattern.primaryLane.pct}%).`,
      priority: 3,
    });
  }

  if (
    context.kickoutPerformance.worstLane &&
    context.kickoutPerformance.bestLane &&
    context.kickoutPerformance.worstLane.key !== context.kickoutPerformance.bestLane.key &&
    meaningfulGap(context.kickoutPerformance.bestLane.pct, context.kickoutPerformance.worstLane.pct, 20)
  ) {
    items.push({
      type: 'avoid_restart_lane',
      title: `Avoid ${context.kickoutPerformance.worstLane.label} on our restarts`,
      reason: `${context.kickoutPerformance.worstLane.label} is returning ${context.kickoutPerformance.worstLane.pct}%, compared with ${context.kickoutPerformance.bestLane.pct}% on ${context.kickoutPerformance.bestLane.label}.`,
      priority: 4,
    });
  }

  if (context.opportunity.bestSide) {
    items.push({
      type: 'attack_strong_side',
      title: `Attack the ${context.opportunity.bestSide.label}`,
      reason: `${context.opportunity.bestSide.label} is producing our best attacks so far.`,
      priority: 5,
    });
  } else if (context.opportunity.bestLane) {
    items.push({
      type: 'use_best_restart_lane',
      title: `Lean on ${context.opportunity.bestLane.label} restarts`,
      reason: `${context.opportunity.bestLane.label} is our steadiest restart route (${context.opportunity.bestLane.pct}%).`,
      priority: 6,
    });
  }

  if (context.threat.channelThreat) {
    items.push({
      type: 'protect_danger_side',
      title: `Protect the ${context.threat.channelThreat.label}`,
      reason: `Most of their danger is coming through the ${context.threat.channelThreat.label}.`,
      priority: 7,
    });
  }

  return items
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}

export function buildLiveInsights(events = []) {
  const ordered = sortEvents(events);
  const scoreEvents = ordered
    .filter(isScoreEvent)
    .map((event) => {
      const points = shotPoints(event);
      let label = 'P';
      if (points === 3) label = 'G';
      else if (points === 2) label = '2P';

      return {
        id: event.id,
        team: direction(event),
        label,
        points,
        clock: event.clock || '',
        minute: absoluteMinute(event),
        event,
      };
    });
  const kickoutEvents = ordered
    .filter((event) => eventType(event) === 'kickout')
    .map((event) => ({
      id: event.id,
      team: kickoutController(event),
      controller: kickoutController(event),
      direction: direction(event),
      result: isPositiveKickout(event) ? 'won' : 'lost',
      lane: laneLabel(event),
      label: isPositiveKickout(event) ? 'W' : 'L',
      value: 1,
      clock: event.clock || '',
      minute: absoluteMinute(event),
      event,
    }));

  const scoreMomentumItems = scoreEvents.slice(-8);
  const kickoutMomentumItems = kickoutEvents.slice(-8);

  const kickoutSummary = buildKickoutPattern(ordered);
  const kickoutPerformance = buildKickoutPerformance(ordered);
  const threat = buildThreatMap(ordered);
  const opportunity = buildOpportunity(ordered, kickoutPerformance);
  const recommendations = buildRecommendations({
    kickoutPattern: kickoutSummary,
    kickoutPerformance,
    threat,
    opportunity,
  });

  return {
    scoreMomentum: {
      items: scoreMomentumItems,
      ...summarizeScoreWindow(scoreMomentumItems),
    },
    kickoutMomentum: {
      items: kickoutMomentumItems,
      ...summarizeControllerWindow(kickoutMomentumItems),
    },
    flow: {
      scoreItems: scoreEvents,
      kickoutItems: kickoutEvents,
      ...buildFlowNarratives(scoreEvents, kickoutEvents),
    },
    kickoutPattern: kickoutSummary,
    kickoutPerformance,
    threat,
    opportunity,
    recommendations,
    keepDoing: opportunity.keepDoing,
  };
}
