const SIMNI_TIMEZONE='Asia/Jakarta';
function jakartaParts(d=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:SIMNI_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]))}
function getJakartaDateString(d=new Date()){const p=jakartaParts(d);return `${p.year}-${p.month}-${p.day}`}
function getJakartaMonthString(d=new Date()){const p=jakartaParts(d);return `${p.year}-${p.month}`}
function normalizeDate(raw){if(!raw)return '';const r=raw.toString();return r.includes('T')?r.split('T')[0]:r.split(' ')[0]}
function getNamaHari(ds){const [y,m,d]=String(ds).split('-').map(Number);return new Intl.DateTimeFormat('id-ID',{weekday:'long',timeZone:SIMNI_TIMEZONE}).format(new Date(Date.UTC(y,m-1,d,12)))}
function initDates(){const today=getJakartaDateString();const pd=document.getElementById('presensi-date');if(pd&&!pd.value)pd.value=today;const cd=document.getElementById('input-catatan-tanggal');if(cd&&!cd.value)cd.value=today;const jd=document.getElementById('input-jurnal-tanggal');const ft=document.getElementById('filter-presensi-tanggal');if(ft&&!ft.value)ft.value=today;if(jd&&!jd.value){jd.value=today;lastJurnalDate=today;if(typeof generateFormJurnal==='function')setTimeout(generateFormJurnal,300)}}
