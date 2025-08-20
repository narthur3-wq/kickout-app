<script>
  import { createEventDispatcher } from 'svelte';
  import * as XLSX from 'xlsx';

  const WIDTH_M=90, LENGTH_M=145;
  export let open=false;
  const dispatch=createEventDispatcher();

  let file=null, sheetNames=[], chosenSheet='';
  let headers=[], rows=[];
  let coordsUnit='auto';   // 'auto' | 'norm' | 'meters'
  let defaultGoalTop=true;
  let map={};

  const FIELDS=[
    {key:'match_date',label:'Match date (YYYY-MM-DD)'},{key:'team',label:'Team'},{key:'opponent',label:'Opponent'},
    {key:'period',label:'Period (H1/H2)'},{key:'clock',label:'Clock (mm:ss)'},{key:'target_player',label:'Target player'},
    {key:'outcome',label:'Outcome'},{key:'contest_type',label:'Contest type'},{key:'break_outcome',label:'Break outcome'},
    {key:'time_to_tee_s',label:'Time to tee (s)'},{key:'total_time_s',label:'Total time (s)'},{key:'scored_20s',label:'Scored ≤20s'},
    {key:'x',label:'Landing X (0–1)'},{key:'y',label:'Landing Y (0–1)'},{key:'x_m',label:'Landing X (m)'},{key:'y_m',label:'Landing Y (m)'},
    {key:'pickup_x',label:'Pickup X (0–1)'},{key:'pickup_y',label:'Pickup Y (0–1)'},{key:'pickup_x_m',label:'Pickup X (m)'},{key:'pickup_y_m',label:'Pickup Y (m)'},
    {key:'zone_code',label:'Zone code'},{key:'side_band',label:'Side band'},{key:'depth_band',label:'Depth band'},
    {key:'our_goal_at_top',label:'Our goal at top (bool)'}
  ];

  const norm=s=>(s??'').toString().trim().toLowerCase();

  function reset(){ headers=[]; rows=[]; sheetNames=[]; chosenSheet=''; map={}; }

  async function onPickFile(e){
    reset();
    file=e.target.files?.[0]||null; if(!file) return;
    const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'});
    sheetNames=wb.SheetNames; chosenSheet=sheetNames[0];
    parseSheet(wb, chosenSheet);
  }
  function parseSheet(wb,name){
    const ws=wb.Sheets[name];
    const data=XLSX.utils.sheet_to_json(ws,{header:1,raw:true});
    headers=(data[0]||[]).map(String);
    rows=data.slice(1);
    map=autoMap(headers);
  }
  function onChangeSheet(name){(async()=>{const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});parseSheet(wb,name)})()}

  function autoMap(hs){
    const m={}; const find=(...cands)=>hs.find(h=>cands.some(x=>norm(h).includes(x)))||'';
    m.match_date=find('date');
    m.team=find('team');
    m.opponent=find('opponent','opp');
    m.period=find('period','half');
    m.clock=find('clock','time');
    m.target_player=find('target','player','receiver');
    m.outcome=find('outcome','result');
    m.contest_type=find('contest','type');
    m.break_outcome=find('break outcome','break');
    m.time_to_tee_s=find('tee');
    m.total_time_s=find('total');
    m.scored_20s=find('20','within 20');
    m.x=hs.find(h=>/landing.*x\b|^x$/.test(norm(h)))||'';
    m.y=hs.find(h=>/landing.*y\b|^y$/.test(norm(h)))||'';
    m.x_m=hs.find(h=>/x.*(m|met)/.test(norm(h)))||'';
    m.y_m=hs.find(h=>/y.*(m|met)/.test(norm(h)))||'';
    m.pickup_x=hs.find(h=>/pickup.*x/.test(norm(h)))||'';
    m.pickup_y=hs.find(h=>/pickup.*y/.test(norm(h)))||'';
    m.pickup_x_m=hs.find(h=>/pickup.*x.*(m|met)/.test(norm(h)))||'';
    m.pickup_y_m=hs.find(h=>/pickup.*y.*(m|met)/.test(norm(h)))||'';
    m.zone_code=find('zone'); m.side_band=find('side'); m.depth_band=find('depth');
    m.our_goal_at_top=find('goal at top','orientation');
    return m;
  }

  const zCenterX = (s) => {
    const v = norm(s);
    if (v.startsWith('l')) return 1/6;
    if (v.startsWith('r')) return 5/6;
    return 0.5;
  };
  const zCenterDepthM = (d) => {
    const v = norm(d);
    if (v==='s' || v.startsWith('sh')) return 10;
    if (v==='m' || v.startsWith('me')) return 32.5;
    if (v==='l' || v.startsWith('lo')) return 55;
    return 105;
  };
  function centerFromZoneCode(z){
    const [s,d] = (z||'').split('-');
    return { nx: zCenterX(s), depthM: zCenterDepthM(d) };
  }

  const toBool = v => ['true','1','y','yes','✓'].includes(norm(v));
  const toNum  = v => v===''||v==null ? null : (isNaN(+v) ? null : +v);

  function parseRow(row){
    const obj = Object.fromEntries(headers.map((h,i)=>[h,row[i]]));
    const get = (k)=> map[k] ? obj[map[k]] : undefined;

    const team=(get('team')??'').toString().trim();
    const opponent=(get('opponent')??'').toString().trim();
    const target_player=(get('target_player')??'').toString().trim();
    const period=(get('period')??'').toString().trim() || 'H1';
    const clock=(get('clock')??'').toString().trim();
    const match_date=(get('match_date')??'').toString().trim();

    const outcome=(get('outcome')??'').toString().trim() || 'Retained';
    const contest_type=(get('contest_type')??'').toString().trim() || 'clean';
    const break_outcome=(get('break_outcome')??'').toString().trim();

    const time_to_tee_s=toNum(get('time_to_tee_s'));
    const total_time_s=toNum(get('total_time_s'));
    const scored_20s=toBool(get('scored_20s'));

    let our_goal_at_top = get('our_goal_at_top')!==undefined ? toBool(get('our_goal_at_top')) : defaultGoalTop;

    let nx=toNum(get('x')), ny=toNum(get('y'));
    let xm=toNum(get('x_m')), ym=toNum(get('y_m'));

    if ((nx==null||ny==null) && (xm==null||ym==null)){
      const zc=(get('zone_code')??'').toString().trim();
      const sb=(get('side_band')??'').toString().trim();
      const db=(get('depth_band')??'').toString().trim();
      if (zc){
        const {nx:zx, depthM} = centerFromZoneCode(zc);
        nx = zx; ym = depthM;
      } else if (sb||db){
        nx = zCenterX(sb||'C'); ym = zCenterDepthM(db||'M');
      }
    }

    const maybeMeters = v => v!=null && Math.abs(v) > 1.001;
    const unit = coordsUnit==='auto' ? ((maybeMeters(xm)||maybeMeters(ym)||maybeMeters(nx)||maybeMeters(ny))?'meters':'norm') : coordsUnit;

    if (unit==='meters'){
      if (nx==null && xm!=null) nx = xm / WIDTH_M;
      if (ny==null && ym!=null) ny = our_goal_at_top ? (ym/LENGTH_M) : (1-ym/LENGTH_M);
    } else {
      if (xm!=null && nx==null) nx = xm / WIDTH_M;
      if (ym!=null && ny==null) ny = our_goal_at_top ? (ym/LENGTH_M) : (1-ym/LENGTH_M);
    }

    if (nx==null || ny==null || isNaN(nx) || isNaN(ny)) return null;
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));

    let px=toNum(get('pickup_x')), py=toNum(get('pickup_y'));
    let pxm=toNum(get('pickup_x_m')), pym=toNum(get('pickup_y_m'));
    if (unit==='meters'){
      if (px==null && pxm!=null) px = pxm / WIDTH_M;
      if (py==null && pym!
