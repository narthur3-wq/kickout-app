<script>
  import { events, meta, updateEvent } from '../stores.js';

  // ======= constants & palettes =======
  const LOSS_CATEGORIES = [
    { key:'', label:'—' },
    { key:'mechanics', label:'Mechanics' },
    { key:'decision', label:'Decision Making' },
    { key:'kick_type', label:'Kick Type' },
    { key:'player', label:'Player' },
    { key:'break', label:'Break' },
  ];
  const DEPTHS = ['Short','Medium','Long','Very Long'];
  const SIDES3 = ['Left','Centre','Right'];

  const C = {
    bg:'#F5F7FA', card:'#FFFFFF', grid:'#E2E8F0', axis:'#64748B',
    win:'#0F9D58', loss:'#C81E1E', info:'#2563EB', bar:'#94A3B8',
    cat: {
      mechanics:'#7C3AED', decision:'#EA580C', kick_type:'#059669',
      player:'#0EA5E9', break:'#DC2626', '—':'#A1A1AA'
    }
  };

  // ======= sub tabs =======
  let sub = 'enhance'; // 'enhance' | 'overview' | 'trends' | 'players' | 'zones' | 'opponents' | 'losses'

  // ======= filters =======
  let qSide = 'all';   // 'all'|'us'|'opp'
  let qShow = 'all';   // 'all'|'wins'|'losses'
  let qText = '';      // free text

  const norm = (s)=> String(s||'').toLowerCase();
  function chipSide(s){ qSide = s; }
  function chipShow(s){ qShow = s; }
  function clearFilters(){ qSide='all'; qShow='all'; qText=''; }

  $: filtered = $events.filter(e=>{
    if(qSide!=='all' && e.side!==qSide) return false;
    if(qShow==='wins' && !e.win) return false;
    if(qShow==='losses' && e.win) return false;
    if(qText){
      const blob = `${e.opposition_name||''} ${e.game_result||''} ${e.target_player||''} ${e.opponent_receiver||''}`;
      if(!norm(blob).includes(norm(qText))) return false;
    }
    return true;
  });

  // ======= table sort =======
  let sortKey='date', sortDir='desc';
  const v = (r,k)=>{
    switch(k){
      case 'date':  return new Date(r.match_date || r.created_at || 0).getTime();
      case 'side':  return r.side||'';
      case 'contest': return r.contest_type||'';
      case 'wl':    return r.win?1:0;
      case 'player': return r.target_player||'';
      case 'oppRecv': return r.opponent_receiver||'';
      case 'opp':   return r.opposition_name || r.opponent || '';
      case 'depth': return r.depth_band || '';
      case 'zone':  return r.zone_code || '';
      default: return 0;
    }
  };
  function setSort(k){
    if(sortKey===k) sortDir = (sortDir==='asc'?'desc':'asc');
    else { sortKey=k; sortDir='asc'; }
  }
  $: tableRows = [...filtered].sort((a,b)=>{
    const A=v(a,sortKey), B=v(b,sortKey);
    if(A<B) return sortDir==='asc'?-1:1;
    if(A>B) return sortDir==='asc'? 1:-1;
    return 0;
  });

  // ======= aggregators =======
  const pct = (n,d)=> d? Math.round(100*n/d):0;
  const sum = a => a.reduce((x,y)=>x+y,0);
  const median = a => {
    if(!a.length) return 0;
    const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2);
    return s.length%2? s[m] : Math.round((s[m-1]+s[m])/2);
  };
  const round1 = n => Math.round(n*10)/10;

  function byOpponent(list){
    const m = new Map();
    for(const e of list){
      const k = (e.opposition_name||e.opponent||'–').trim();
      const t = m.get(k) || { opp:k, total:0, win:0, short:0, med:0, long:0, vlong:0 };
      t.total++; if(e.win) t.win++;
      if(e.depth_band==='Very Long') t.vlong++;
      else if(e.depth_band==='Long') t.long++;
      else if(e.depth_band==='Medium') t.med++;
      else t.short++;
      m.set(k,t);
    }
    const rows = [...m.values()]
      .map(r=>({...r, wPct:pct(r.win,r.total), longShare:pct(r.long+r.vlong,r.total)}))
      .sort((a,b)=> a.opp.localeCompare(b.opp));
    const tot = rows.reduce((acc,r)=>({
      total:acc.total+r.total, win:acc.win+r.win, short:acc.short+r.short, med:acc.med+r.med, long:acc.long+r.long, vlong:acc.vlong+r.vlong
    }), {total:0,win:0,short:0,med:0,long:0,vlong:0});
    return {
      rows,
      totals:{opp:'Totals', total:tot.total, win:tot.win, wPct:pct(tot.win,tot.total), longShare:pct(tot.long+tot.vlong,tot.total),
              short:tot.short, med:tot.med, long:tot.long, vlong:tot.vlong}
    };
  }
  function topByKey(list, key, take=10){
    const m = new Map();
    for(const e of list){
      const k=(e[key]||'').trim(); if(!k) continue;
      const t=m.get(k)||{label:k,total:0,win:0}; t.total++; if(e.win) t.win++; m.set(k,t);
    }
    return [...m.values()]
      .map(r=>({...r, wPct:pct(r.win,r.total)}))
      .sort((a,b)=> b.total-a.total || b.wPct-a.wPct)
      .slice(0,take);
  }
  function lossBreakdown(list){
    const m = new Map();
    for(const e of list){
      if(e.win) continue;
      const k = e.loss_category || '—';
      const t = m.get(k)||{label:k,count:0}; t.count++; m.set(k,t);
    }
    return [...m.values()].sort((a,b)=> b.count-a.count);
  }
  function zonesMatrix(list){
    const M = SIDES3.map(()=> DEPTHS.map(()=>({att:0,win:0})));
    for(const e of list){
      const r = Math.max(0, SIDES3.indexOf(e.side_band||''));
      const c = Math.max(0, DEPTHS.indexOf(e.depth_band||''));
      M[r][c].att++; if(e.win) M[r][c].win++;
    }
    return M;
  }

  // derivatives for overview/opponents
  $: byOpp = byOpponent(filtered);

  // ======= trends helpers =======
  function groupByDate(list){
    const m = new Map();
    for(const e of list){
      const d = (e.match_date || (e.created_at||'').slice(0,10) || '—');
      const t = m.get(d) || { date:d, att:0, win:0, long:0, tee:[], kick:[] };
      t.att++; if(e.win) t.win++;
      if(e.depth_band==='Long' || e.depth_band==='Very Long') t.long++;
      if(e.time_to_tee!=='' && e.time_to_tee!=null) t.tee.push(Number(e.time_to_tee));
      if(e.time_to_kick!=='' && e.time_to_kick!=null) t.kick.push(Number(e.time_to_kick));
      m.set(d,t);
    }
    return [...m.values()].sort((a,b)=> a.date.localeCompare(b.date))
      .map(r=>({...r, winPct:pct(r.win,r.att), longPct:pct(r.long,r.att),
                medTee:median(r.tee), medKick:median(r.kick)}));
  }
  function rolling(series, key, w=7){
    const out=[];
    for(let i=0;i<series.length;i++){
      const from = Math.max(0, i-w+1);
      const slice = series.slice(from,i+1).map(d=>d[key]).filter(v=>v!=null);
      out.push({date:series[i].date, y: slice.length? Math.round(sum(slice)/slice.length):null});
    }
    return out;
  }

  // ======= edit helpers =======
  function fmtNum(n){ return n==null||n==='' ? '' : Number(n); }
  function onChange(e,id,field){
    const v=e.currentTarget.value;
    updateEvent(id, { [field]: field.startsWith('time_') ? fmtNum(v): v });
  }
  function onBoolChange(e,id,field){ updateEvent(id, { [field]: e.currentTarget.value==='W' }); }

  // bulk edit
  let bulkOpp=''; let bulkRes='';
  function applyBulk(field, value){ for(const r of filtered){ updateEvent(r.id, {[field]:value}); } }

  // ======= export helpers =======
  let dashRef;
  async function exportPNG(){
    try{
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(dashRef, {scale:2, backgroundColor:C.bg});
      const url = canvas.toDataURL('image/png');
      const a=document.createElement('a'); a.href=url; a.download='dashboards.png'; a.click();
    }catch(err){
      alert('PNG export needs html2canvas (npm i html2canvas)');
      console.error(err);
    }
  }
  function exportCSV(rows){
    const headers=['id','date','side','contest','win','target_player','opponent_receiver','opposition_name','game_result','time_to_tee','time_to_kick','side_band','depth_band','zone_code','x_m','y_m'];
    const lines=[headers.join(',')];
    for(const r of rows){
      const row=[
        r.id,
        r.match_date || (r.created_at||'').slice(0,10),
        r.side,
        r.contest_type,
        r.win?'W':'L',
        r.target_player||'',
        r.opponent_receiver||'',
        r.opposition_name||'',
        r.game_result||'',
        r.time_to_tee??'',
        r.time_to_kick??'',
        r.side_band||'',
        r.depth_band||'',
        r.zone_code||'',
        Math.round(Number(r.x_m||0)),
        Math.round(Number(r.y_m||0)),
      ].map(v => (typeof v==='number'? String(v): `"${String(v).replace(/"/g,'""')}"`));
      lines.push(row.join(','));
    }
    const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a'); a.href=url; a.download='review.csv'; a.click(); URL.revokeObjectURL(url);
  }
  function exportJSON(){
    const blob=new Blob([JSON.stringify($events,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='kickouts.json'; a.click(); URL.revokeObjectURL(url);
  }
  let importEl;
  function importJSONClick(){ importEl?.click(); }
  function onImportJSON(e){
    const f=e.currentTarget.files?.[0]; if(!f) return;
    const fr=new FileReader();
    fr.onload=()=>{
      try{
        const data=JSON.parse(String(fr.result)||'[]');
        if(!Array.isArray(data)) { alert('Invalid JSON'); return; }
        const byId=new Map($events.map(x=>[x.id,x]));
        for(const ev of data){ byId.set(ev.id||crypto.randomUUID(), {...byId.get(ev.id)||{}, ...ev}); }
        events.set([...byId.values()]);
        alert('Imported events');
      }catch(err){ alert('Failed to import JSON'); console.error(err); }
    };
    fr.readAsText(f); e.currentTarget.value='';
  }

  // ======= chart helpers (return SVG strings) =======
  function xTicks(dates, max=6){
    const n=dates.length; if(n===0) return [];
    if(n<=max) return dates;
    const step=Math.ceil(n/max); const out=[];
    for(let i=0;i<n;i+=step) out.push(dates[i]);
    if(out[out.length-1]!==dates[n-1]) out.push(dates[n-1]);
    return out;
  }

  function lineChart(series, xKey, yKey, {w=640,h=220,yMax=100,color='#111827', ra=null}={}){
    const pad={t:10,r:20,b:30,l:36}; const innerW=w-pad.l-pad.r; const innerH=h-pad.t-pad.b;
    const xs=series.map(d=>d[xKey]); const ys=series.map(d=>d[yKey]??null); const yMaxEff=Math.max(1,yMax);
    const X=(i)=> pad.l + innerW*(i/(xs.length-1||1)); const Y=(v)=> pad.t + innerH*(1-(v/yMaxEff));
    const path=[]; ys.forEach((v,i)=>{ if(v==null) return; path.push(`${path.length?'L':'M'}${X(i)},${Y(v)}`); });
    const raPath=[]; if(ra){ ra.forEach((d,i)=>{ if(d.y==null) return; raPath.push(`${raPath.length?'L':'M'}${X(i)},${Y(d.y)}`); }); }
    const yt=[0,yMaxEff/2,yMaxEff].map(v=>({v,y:Y(v)})); const xt=xTicks(xs,6).map(d=>({d,i:xs.indexOf(d)}));
    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <rect x="0" y="0" width="${w}" height="${h}" fill="${C.card}"/>
        ${yt.map(t=>`<line x1="${pad.l}" y1="${t.y}" x2="${w-pad.r}" y2="${t.y}" stroke="${C.grid}"/>`).join('')}
        <path d="${path.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>
        ${ra?`<path d="${raPath.join(' ')}" fill="none" stroke="${C.bar}" stroke-dasharray="4 4" stroke-width="2"/>`:''}
        ${yt.map(t=>`<text x="${pad.l-6}" y="${t.y+4}" text-anchor="end" font-size="11" fill="${C.axis}">${Math.round(t.v)}</text>`).join('')}
        ${xt.map(t=>`<line x1="${X(t.i)}" x2="${X(t.i)}" y1="${h-pad.b}" y2="${h-pad.b+4}" stroke="${C.axis}"/>
                      <text x="${X(t.i)}" y="${h-6}" text-anchor="middle" font-size="11" fill="${C.axis}">${t.d.slice(5)}</text>`).join('')}
      </svg>`;
  }

  function bubbleChart(points,{w=640,h=330}={}){
    const pad={t:10,r:10,b:30,l:36}; const innerW=w-pad.l-pad.r; const innerH=h-pad.t-pad.b;
    const maxShare=Math.max(1,...points.map(p=>p.share)); const maxAtt=Math.max(1,...points.map(p=>p.att));
    const X=p=> pad.l + innerW*(p.winPct/100); const Y=p=> pad.t + innerH*(1-(p.share/maxShare)); const R=p=> 6 + 18*Math.sqrt(p.att/maxAtt);
    const xt=[0,25,50,75,100]; const yt=[0,round1(maxShare/2),maxShare];
    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <rect x="0" y="0" width="${w}" height="${h}" fill="${C.card}"/>
        ${yt.map(v=>{ const y=pad.t+innerH*(1-(v/maxShare));
          return `<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="${C.grid}"/>
                  <text x="${pad.l-6}" y="${y+4}" text-anchor="end" font-size="11" fill="${C.axis}">${v}%</text>`;
        }).join('')}
        ${xt.map(v=>{ const x=pad.l+innerW*(v/100);
          return `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${h-pad.b}" stroke="${C.grid}"/>
                  <text x="${x}" y="${h-6}" text-anchor="middle" font-size="11" fill="${C.axis}">${v}%</text>`;
        }).join('')}
        ${points.map(p=>`
          <circle cx="${X(p)}" cy="${Y(p)}" r="${R(p)}" fill="${C.info}" fill-opacity="0.25" stroke="${C.info}"/>
          <text x="${X(p)}" y="${Y(p)+4}" text-anchor="middle" font-size="11" fill="#111">${p.label}</text>
        `).join('')}
      </svg>`;
  }

  function zoneCell(cell){
    const att=cell.att, win=cell.win, wp=pct(win,att);
    const col = att? (wp>=60? '#DCFCE7' : wp>=40? '#E5E7EB' : '#FEE2E2') : '#F8FAFC';
    return `<div class="zcell" style="background:${col}">
      <div class="zv">${att?`${wp}%`:'—'}</div>
      <div class="za">${att} att</div>
    </div>`;
  }

  function paretoChart(catRows,{w=640,h=280}={}){
    const pad={t:10,r:40,b:30,l:36}, innerW=w-pad.l-pad.r, innerH=h-pad.t-pad.b;
    const total=sum(catRows.map(r=>r.count)); const maxC=Math.max(1,...catRows.map(r=>r.count));
    const step = innerW / (catRows.length || 1);
    let cum=0; const cumPts=catRows.map((r,i)=>{ cum+=r.count; return {i,p:Math.round(100*cum/Math.max(1,total))}; });
    const path=cumPts.map((d,i)=>`${i?'L':'M'}${pad.l+step*(d.i+0.5)},${pad.t+innerH*(1-d.p/100)}`).join(' ');
    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <rect width="${w}" height="${h}" fill="${C.card}"/>
        ${catRows.map((r,i)=>{ const hgt=innerH*(r.count/maxC), x=pad.l+step*i+6, bw=step-12;
          return `<rect x="${x}" y="${pad.t+innerH-hgt}" width="${bw}" height="${hgt}" fill="${C.cat[r.label]||C.bar}"/>
                  <text x="${x+bw/2}" y="${h-6}" text-anchor="middle" font-size="11" fill="${C.axis}">${r.label||'—'}</text>`;
        }).join('')}
        <path d="${path}" fill="none" stroke="${C.info}" stroke-width="2.5"/>
        <text x="${w-pad.r+2}" y="${pad.t+8}" font-size="11" fill="${C.axis}">Cumulative %</text>
      </svg>`;
  }

  function stackedLossChart(byDate,{w=640,h=280}={}){
    const pad={t:10,r:20,b:30,l:36}, innerW=w-pad.l-pad.r, innerH=h-pad.t-pad.b;
    const maxTot = Math.max(1, ...byDate.map(d=>sum(Object.values(d.cats))));
    const step = innerW / (byDate.length || 1);
    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <rect width="${w}" height="${h}" fill="${C.card}"/>
        ${byDate.map((d,i)=>{ let y=pad.t+innerH; const x=pad.l+step*i+6, bw=step-12;
          const parts=Object.keys(d.cats).map(k=>({k,v:d.cats[k]})).filter(p=>p.v>0);
          return parts.map(p=>{ const hgt=innerH*(p.v/maxTot); y-=hgt;
            return `<rect x="${x}" y="${y}" width="${bw}" height="${hgt}" fill="${C.cat[p.k]||C.bar}"/>`;
          }).join('') + `<text x="${x+bw/2}" y="${h-6}" text-anchor="middle" font-size="11" fill="${C.axis}">${d.date.slice(5)}</text>`;
        }).join('')}
      </svg>`;
  }

  // ======= view-model builders =======
  function buildPlayers(list){
    const ours=list.filter(e=>e.side==='us'); const tot=ours.length||1;
    const top=topByKey(ours,'target_player',15);
    const bubbles=top.map(r=>({ label:r.label||'—', winPct:r.wPct, share:Math.round(100*r.total/tot), att:r.total }));
    return { top, bubbles };
  }
  function buildLossViews(list){
    const byCat=lossBreakdown(list);
    const m=new Map();
    for(const e of list){
      if(e.win) continue;
      const d=(e.match_date||(e.created_at||'').slice(0,10)||'—');
      const t=m.get(d)||{date:d,cats:{}};
      const k=e.loss_category||'—'; t.cats[k]=(t.cats[k]||0)+1; m.set(d,t);
    }
    const byDate=[...m.values()].sort((a,b)=> a.date.localeCompare(b.date));
    return { byCat, byDate };
  }

  $: $meta; // ensure reactivity to opponent placeholder
</script>

<div class="review" style="--bg:{C.bg}; --card:{C.card}; --tx:#0A0A0A; --mut:#4B5563; --border:#CBD5E1; --track:#D1D5DB; --win:{C.win}; --loss:{C.loss}; --accent:{C.info}; --grid:{C.grid};">
  <!-- sub tabs -->
  <div class="subtabs">
    <button class:active={sub==='enhance'} on:click={()=>sub='enhance'}>Enhance</button>
    <button class:active={sub==='overview'} on:click={()=>sub='overview'}>Overview</button>
    <button class:active={sub==='trends'} on:click={()=>sub='trends'}>Trends</button>
    <button class:active={sub==='players'} on:click={()=>sub='players'}>Players</button>
    <button class:active={sub==='zones'} on:click={()=>sub='zones'}>Zones</button>
    <button class:active={sub==='opponents'} on:click={()=>sub='opponents'}>Opponents</button>
    <button class:active={sub==='losses'} on:click={()=>sub='losses'}>Losses</button>
  </div>

  <!-- shared filters -->
  <div class="filters card">
    <div class="chiprow">
      <button class:active={qSide==='us'} on:click={()=>chipSide('us')}>Us</button>
      <button class:active={qSide==='opp'} on:click={()=>chipSide('opp')}>Opp</button>
      <span class="sep"></span>
      <button class:active={qShow==='wins'} on:click={()=>chipShow('wins')}>Wins</button>
      <button class:active={qShow==='losses'} on:click={()=>chipShow('losses')}>Losses</button>
      <span class="sep"></span>
      <button class="ghost" on:click={clearFilters}>Clear</button>
    </div>

    <div class="row">
      <div class="group">
        <label for="f-side">Side</label>
        <select id="f-side" bind:value={qSide}>
          <option value="all">All</option>
          <option value="us">Us</option>
          <option value="opp">Opposition</option>
        </select>
      </div>

      <div class="group">
        <label for="f-show">Show</label>
        <select id="f-show" bind:value={qShow}>
          <option value="all">All</option>
          <option value="wins">Wins</option>
          <option value="losses">Losses</option>
        </select>
      </div>

      <div class="group grow">
        <label for="f-search">Search</label>
        <input id="f-search" placeholder="Opposition / player / result…" bind:value={qText} />
      </div>

      <div class="group end">
        <button class="ghost" on:click={()=>exportCSV(tableRows)}>Export CSV</button>
        <button class="ghost" on:click={exportJSON}>Export JSON</button>
        <input type="file" accept="application/json" bind:this={importEl} on:change={onImportJSON} hidden>
        <button class="ghost" on:click={importJSONClick}>Import JSON</button>
      </div>
    </div>
  </div>

  <!-- ENHANCE -->
  {#if sub==='enhance'}
    <div class="card bulk">
      <div class="group">
        <label for="bulk-opp">Set Opposition (for filtered)</label>
        <div class="inline">
          <input id="bulk-opp" placeholder={$meta.opponent} bind:value={bulkOpp}>
          <button on:click={()=>{ if(bulkOpp.trim()) applyBulk('opposition_name', bulkOpp.trim()); }}>Apply</button>
        </div>
      </div>
      <div class="group">
        <label for="bulk-res">Set Game Result (for filtered)</label>
        <div class="inline">
          <input id="bulk-res" placeholder="e.g. W: 1-15 to 1-12" bind:value={bulkRes}>
          <button on:click={()=>{ if(bulkRes.trim()) applyBulk('game_result', bulkRes.trim()); }}>Apply</button>
        </div>
      </div>
    </div>

    <div class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th><button class="thbtn" on:click={()=>setSort('date')}>Date</button></th>
            <th><button class="thbtn" on:click={()=>setSort('side')}>Side</button></th>
            <th><button class="thbtn" on:click={()=>setSort('contest')}>Contest</button></th>
            <th><button class="thbtn" on:click={()=>setSort('wl')}>W/L</button></th>
            <th><button class="thbtn" on:click={()=>setSort('player')}>Player</button></th>
            <th><button class="thbtn" on:click={()=>setSort('oppRecv')}>Opp receiver</button></th>
            <th><button class="thbtn" on:click={()=>setSort('opp')}>Opposition</button></th>
            <th>Result</th>
            <th>Time to tee (s)</th>
            <th>Total time (s)</th>
            <th>Loss category</th>
            <th><button class="thbtn" on:click={()=>setSort('depth')}>Depth</button></th>
            <th><button class="thbtn" on:click={()=>setSort('zone')}>Zone</button></th>
          </tr>
        </thead>
        <tbody>
          {#each tableRows as r}
            <tr>
              <td>{r.match_date || (r.created_at||'').slice(0,10)}</td>
              <td class="mono">{r.side}</td>
              <td class="mono">{r.contest_type}</td>
              <td>
                <select class={r.win?'w':'l'} on:change={(e)=>onBoolChange(e,r.id,'win')}>
                  <option value="W" selected={r.win}>W</option>
                  <option value="L" selected={!r.win}>L</option>
                </select>
              </td>
              <td><input value={r.target_player||''} on:change={(e)=>onChange(e,r.id,'target_player')} placeholder="—" /></td>
              <td><input value={r.opponent_receiver||''} on:change={(e)=>onChange(e,r.id,'opponent_receiver')} placeholder="—" /></td>
              <td><input value={r.opposition_name||$meta.opponent||''} on:change={(e)=>onChange(e,r.id,'opposition_name')} placeholder={$meta.opponent} /></td>
              <td><input value={r.game_result||''} on:change={(e)=>onChange(e,r.id,'game_result')} placeholder="e.g. W: 1-15 to 1-12" /></td>
              <td><input type="number" min="0" step="1" value={r.time_to_tee ?? ''} on:change={(e)=>onChange(e,r.id,'time_to_tee')} /></td>
              <td><input type="number" min="0" step="1" value={r.time_to_kick ?? ''} on:change={(e)=>onChange(e,r.id,'time_to_kick')} /></td>
              <td>
                {#if !r.win}
                  <select value={r.loss_category||''} on:change={(e)=>onChange(e,r.id,'loss_category')}>
                    {#each LOSS_CATEGORIES as c}
                      <option value={c.key} selected={c.key===(r.loss_category||'')}>{c.label}</option>
                    {/each}
                  </select>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="mono">{r.depth_band||'—'}</td>
              <td class="mono">{r.zone_code||'—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- OVERVIEW -->
  {#if sub==='overview'}
    <div class="dash-wrap" bind:this={dashRef}>
      <div class="grid-2">
        <div class="card">
          <div class="title">By opponent</div>
          <table class="kpi">
            <thead><tr><th>Opponent</th><th>Win</th><th>Total</th><th>Win %</th><th>Long% of total</th></tr></thead>
            <tbody>
              {#each byOpp.rows as r}
                <tr>
                  <td>{r.opp}</td>
                  <td>{r.win}</td>
                  <td>{r.total}</td>
                  <td class={r.wPct>=60?'good':r.wPct<40?'bad':''}>{r.wPct}%</td>
                  <td>{r.longShare}%</td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="totals">
                <td><strong>{byOpp.totals.opp}</strong></td>
                <td><strong>{byOpp.totals.win}</strong></td>
                <td><strong>{byOpp.totals.total}</strong></td>
                <td><strong>{byOpp.totals.wPct}%</strong></td>
                <td><strong>{byOpp.totals.longShare}%</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="card">
          <div class="title">Lost analysis (count by category)</div>
          <table class="kpi">
            <thead><tr><th>Category</th><th>Count</th></tr></thead>
            <tbody>
              {#each lossBreakdown(filtered) as r}
                <tr><td>{r.label}</td><td>{r.count}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="title">Top 10 — our targets</div>
          <table class="kpi">
            <thead><tr><th>Player</th><th>Att</th><th>Wins</th><th>Win %</th></tr></thead>
            <tbody>
              {#each topByKey(filtered.filter(e=>e.side==='us'),'target_player') as r}
                <tr>
                  <td>{r.label||'—'}</td><td>{r.total}</td><td>{r.win}</td>
                  <td class={r.wPct>=60?'good':r.wPct<40?'bad':''}>{r.wPct}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="title">Top 10 — opposition receivers</div>
          <table class="kpi">
            <thead><tr><th>Receiver</th><th>Contests</th><th>Wins</th><th>Win %</th></tr></thead>
            <tbody>
              {#each topByKey(filtered.filter(e=>e.side==='opp'),'opponent_receiver') as r}
                <tr>
                  <td>{r.label||'—'}</td><td>{r.total}</td><td>{r.win}</td>
                  <td class={r.wPct>=60?'good':r.wPct<40?'bad':''}>{r.wPct}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="actions"><button on:click={exportPNG}>Export dashboards as PNG</button></div>
  {/if}

  <!-- TRENDS -->
  {#if sub==='trends'}
    {#key `${qSide}|${qShow}|${qText}`}
      {#await Promise.resolve(groupByDate(filtered)) then series}
        <div class="grid-2">
          <div class="card">
            <div class="title">Win% over time</div>
            {@html lineChart(series, 'date', 'winPct', {h:220, yMax:100, color:C.win, ra:rolling(series,'winPct',7)})}
          </div>
          <div class="card">
            <div class="title">Long share (Long + Very Long)</div>
            {@html lineChart(series, 'date', 'longPct', {h:220, yMax:100, color:C.info})}
          </div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="title">Median time to tee (s)</div>
            {@html lineChart(series, 'date', 'medTee', {h:220, yMax: Math.max(10, ...series.map(d=>d.medTee||0))+5, color:'#6B7280'})}
          </div>
          <div class="card">
            <div class="title">Median total time to kick (s)</div>
            {@html lineChart(series, 'date', 'medKick', {h:220, yMax: Math.max(10, ...series.map(d=>d.medKick||0))+5, color:'#334155'})}
          </div>
        </div>
      {/await}
    {/key}
  {/if}

  <!-- PLAYERS -->
  {#if sub==='players'}
    {#key `${qSide}|${qShow}|${qText}`}
      {#await Promise.resolve(buildPlayers(filtered)) then P}
        <div class="grid-2">
          <div class="card">
            <div class="title">Targets bubble (x=Win%, y=Share of kicks, size=Attempts)</div>
            {@html bubbleChart(P.bubbles, {h:330})}
          </div>
          <div class="card">
            <div class="title">Top targets (attempts & win%)</div>
            <table class="kpi">
              <thead><tr><th>Player</th><th>Att</th><th>Wins</th><th>Win %</th></tr></thead>
              <tbody>
                {#each P.top as r}
                  <tr>
                    <td>{r.label}</td><td>{r.total}</td><td>{r.win}</td>
                    <td class={r.wPct>=60?'good':r.wPct<40?'bad':''}>{r.wPct}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/await}
    {/key}
  {/if}

  <!-- ZONES -->
  {#if sub==='zones'}
    {#key `${qSide}|${qShow}|${qText}`}
      {#await Promise.resolve(zonesMatrix(filtered)) then M}
        <div class="card">
          <div class="title">Win% heatmap by zone (rows: Left/Centre/Right, cols: Short → Very Long)</div>
          <div class="zones">
            <div class="corner"> </div>
            {#each DEPTHS as d}<div class="colhdr">{d}</div>{/each}
            {#each SIDES3 as s, r}
              <div class="rowhdr">{s}</div>
              {#each DEPTHS as _, c}
                {@html zoneCell(M[r][c])}
              {/each}
            {/each}
          </div>
        </div>
      {/await}
    {/key}
  {/if}

  <!-- OPPONENTS -->
  {#if sub==='opponents'}
    <div class="card">
      <div class="title">Opponents summary with depth mix</div>
      <table class="kpi">
        <thead><tr><th>Opponent</th><th>Win</th><th>Total</th><th>Win%</th><th>Depth mix</th></tr></thead>
        <tbody>
          {#each byOpp.rows as r}
            <tr>
              <td>{r.opp}</td><td>{r.win}</td><td>{r.total}</td>
              <td class={r.wPct>=60?'good':r.wPct<40?'bad':''}>{r.wPct}%</td>
              <td>
                <div class="stackbar" title="Short/Med/Long/VLong">
                  <span style="width:{pct(r.short,r.total)}%; background:#CBD5E1"></span>
                  <span style="width:{pct(r.med,  r.total)}%; background:#94A3B8"></span>
                  <span style="width:{pct(r.long, r.total)}%; background:#4B5563"></span>
                  <span style="width:{pct(r.vlong,r.total)}%; background:#111827"></span>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="totals">
            <td><strong>{byOpp.totals.opp}</strong></td>
            <td><strong>{byOpp.totals.win}</strong></td>
            <td><strong>{byOpp.totals.total}</strong></td>
            <td><strong>{byOpp.totals.wPct}%</strong></td>
            <td>
              <div class="stackbar">
                {#if byOpp.totals.total>0}
                  <span style="width:{pct(byOpp.totals.short,byOpp.totals.total)}%; background:#CBD5E1"></span>
                  <span style="width:{pct(byOpp.totals.med,  byOpp.totals.total)}%; background:#94A3B8"></span>
                  <span style="width:{pct(byOpp.totals.long, byOpp.totals.total)}%; background:#4B5563"></span>
                  <span style="width:{pct(byOpp.totals.vlong,byOpp.totals.total)}%; background:#111827"></span>
                {/if}
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  {/if}

  <!-- LOSSES -->
  {#if sub==='losses'}
    {#key `${qSide}|${qShow}|${qText}`}
      {#await Promise.resolve(buildLossViews(filtered)) then L}
        <div class="grid-2">
          <div class="card">
            <div class="title">Loss categories — Pareto</div>
            {@html paretoChart(L.byCat, {h:280})}
          </div>
          <div class="card">
            <div class="title">Losses by match (stacked)</div>
            {@html stackedLossChart(L.byDate, {h:280})}
          </div>
        </div>
      {/await}
    {/key}
  {/if}
</div>

<style>
  .review{ background:var(--bg); color:var(--tx); padding:12px 14px 18px; }
  .card{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:10px; }
  .grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; }
  @media (max-width:1000px){ .grid-2{ grid-template-columns:1fr; } }

  .subtabs{ display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
  .subtabs button{ border:1px solid var(--border); background:#fff; border-radius:999px; padding:6px 12px; cursor:pointer; }
  .subtabs button.active{ background:#111; color:#fff; border-color:#111; }

  .filters{ display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
  .chiprow{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .chiprow .sep{ width:8px; }
  .chiprow button{ border:1px solid var(--border); border-radius:999px; padding:6px 12px; background:#fff; cursor:pointer; }
  .chiprow button.active{ background:#111; color:#fff; border-color:#111; }
  .row{ display:flex; gap:10px; align-items:end; flex-wrap:wrap; }
  .group{ display:flex; flex-direction:column; gap:4px; }
  .group.grow{ flex:1; min-width:240px; }
  .group.end{ margin-left:auto; display:flex; gap:8px; align-items:end; }
  label{ font-size:12px; color:var(--mut); }
  input, select, button{ border:1px solid var(--border); border-radius:10px; padding:6px 10px; background:#fff; }
  input[type="number"]{ width:90px; }
  .ghost{ background:#fff; }
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  .bulk{ display:flex; gap:16px; flex-wrap:wrap; margin-bottom:10px; }
  .inline{ display:flex; gap:8px; align-items:center; }

  .table-wrap{ overflow:auto; max-height:60vh; }
  .table{ width:100%; border-collapse:separate; border-spacing:0; }
  .table thead th{ position:sticky; top:0; background:var(--card); z-index:2; border-bottom:1px solid var(--grid); }
  .table th, .table td{ border:1px solid var(--grid); padding:6px 8px; text-align:left; white-space:nowrap; }
  .table select.w{ border-color:var(--win); color:var(--win); }
  .table select.l{ border-color:var(--loss); color:var(--loss); }
  .thbtn{ background:transparent; border:none; padding:0; cursor:pointer; font-weight:700; }

  .title{ font-weight:900; margin-bottom:8px; }
  .kpi{ width:100%; border-collapse:collapse; }
  .kpi th, .kpi td{ border:1px solid var(--grid); padding:6px 8px; vertical-align:middle; }
  .kpi td.good{ color:var(--win); font-weight:800; }
  .kpi td.bad{ color:var(--loss); font-weight:800; }
  .kpi tfoot td{ background:#F1F5F9; }

  .actions{ margin-top:10px; display:flex; justify-content:flex-end; }
  .muted{ color:var(--mut); }

  .zones{
    display:grid; grid-template-columns:80px repeat(4,1fr); grid-auto-rows:86px; gap:8px; align-items:stretch;
  }
  .corner{ display:block; min-height:1px; }
  .colhdr,.rowhdr{ font-weight:700; align-self:center; }
  .rowhdr{ display:flex; align-items:center; }
  .zcell{ display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid var(--grid); border-radius:10px; gap:4px; }
  .zv{ font-weight:900; font-size:18px; }
  .za{ font-size:12px; color:#475569; }

  .stackbar{ display:flex; height:10px; width:220px; border:1px solid var(--grid); border-radius:6px; overflow:hidden; }
  .stackbar span{ display:block; height:100%; }
</style>
