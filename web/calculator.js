// Illustrative prototype values only. Replace with owner-approved pricing before launch.
export const PRICING = Object.freeze({
  residential: {
    Essential: { base:1200, kitchen:150000, storage:100000, waterproofing:30000 },
    Elevate: { base:1800, kitchen:250000, storage:180000, waterproofing:45000 },
    Premium: { base:2700, kitchen:400000, storage:300000, waterproofing:65000 }
  },
  office: {
    Essential: { base:1400, kitchen:80000, storage:70000, waterproofing:25000 },
    Elevate: { base:2100, kitchen:140000, storage:130000, waterproofing:40000 },
    Premium: { base:3100, kitchen:220000, storage:220000, waterproofing:60000 }
  }
});
export function calculateEstimate(scope) {
  const {type,tier,area,kitchen,storage,waterproofing}=scope;
  if(!Object.hasOwn(PRICING,type) || !Object.hasOwn(PRICING[type],tier)) throw new RangeError('Select a valid project type and collection.');
  const a=Number(area);
  if(!Number.isInteger(a)||a<100||a>100000) throw new RangeError('Enter a whole-number area from 100 to 100,000 sq ft.');
  const r=PRICING[type][tier];
  const base=a*r.base;
  const additions=(kitchen?r.kitchen:0)+(storage?r.storage:0)+(waterproofing?r.waterproofing:0);
  const subtotal=base+additions;
  const low=Math.round(subtotal*.9),high=Math.round(subtotal*1.1);
  return {area:a,rate:r.base,base,kitchen:kitchen?r.kitchen:0,storage:storage?r.storage:0,waterproofing:waterproofing?r.waterproofing:0,subtotal,low,high,gstRate:.18,gstLow:Math.round(low*.18),gstHigh:Math.round(high*.18),totalLow:Math.round(low*1.18),totalHigh:Math.round(high*1.18)};
}
export const money=n=>'₹'+new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(n);
export const lakh=n=>'₹'+(n/100000).toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2})+' lakh';
