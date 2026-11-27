import assert from "node:assert/strict";
import { test } from "node:test";
import { publicQuotation } from "../lib/quotation-public";
import { calculateQuote, DEFAULT_QUOTE_SETTINGS, formatQuoteMoney, newQuoteInput, newQuoteLine, quoteInputSchema, quoteLineAmount } from "../lib/quotations";

function sample() {
  const input = newQuoteInput(DEFAULT_QUOTE_SETTINGS);
  return { ...input, title:"Website quotation", client:{...input.client,name:"Client Name",email:"quote-test@example.com"},
    lines:[{ ...newQuoteLine(),name:"Website design",unitPrice:3800000 }], discount:300000 };
}

test("PKR acceptance example follows the commercial calculation order", () => {
  const input = quoteInputSchema.parse(sample());
  const result = calculateQuote(input);
  assert.equal(result.oneTime.subtotal, 3800000);
  assert.equal(result.oneTime.discount, 300000);
  assert.equal(result.oneTime.tax, 0);
  assert.equal(result.oneTime.total, 3500000);
  assert.deepEqual(result.milestones.map(item=>item.amount),[1050000,2450000]);
});

test("percentage, rounding, proportional taxable discounts and exempt quotes", () => {
  const input = sample();
  const line = {...input.lines[0],unitPrice:1001,quantity:1250,discount:333};
  assert.equal(quoteLineAmount(line),1209);
  input.lines = [line,{...line,name:"Tax-free",taxable:false,unitPrice:203,quantity:1000,discount:0}];
  input.discountType = "percentage";
  input.discount=1234;
  input.tax=750;
  const total=calculateQuote(input).oneTime;
  assert.deepEqual([total.subtotal,total.discount,total.tax,total.total],[1412,174,80,1318]);
  assert.equal(calculateQuote({...input,taxExempt:true}).oneTime.total,1238);
});

test("recurring, optional, expenses and advances use separate schedules", () => {
  const input = sample();
  input.lines.push({...newQuoteLine(),name:"Monthly plan",unitPrice:50000,recurring:true,cost:7000});
  input.lines.push({...newQuoteLine(),name:"Extra",unitPrice:10000,optional:true,cost:5000,taxable:true});
  input.costs.development=20000;
  const result=calculateQuote(input);
  assert.equal(result.oneTime.total,3500000);
  assert.equal(result.monthly.total,50000);
  assert.equal(result.monthly.profit,43000);
  assert.equal(result.oneTime.costs,20000);
  assert.equal(result.milestones.reduce((sum,item)=>sum+item.amount,0),result.oneTime.total);
  assert.deepEqual(calculateQuote({...input,paymentPlan:"three",advance:7000}).milestones.map(item=>item.share),[7000,1500,1500]);
});

test("custom milestones allocate the entire total, including rounding leftovers", () => {
  const input=sample();
  input.lines=[{...input.lines[0],unitPrice:101}];
  input.discount=0;
  input.paymentPlan="custom";
  input.milestones=[3333,3333,3334].map((share,index)=>({name:"Stage "+index,share,due:"",description:""}));
  assert.equal(quoteInputSchema.safeParse(input).success,true);
  assert.equal(calculateQuote(input).milestones.reduce((sum,item)=>sum+item.amount,0),101);
  assert.equal(quoteInputSchema.safeParse({...input,milestones:input.milestones.slice(0,2)}).success,false);
});

test("invalid inputs and excessive discounts are rejected", () => {
  const input=sample();
  assert.equal(quoteInputSchema.safeParse({...input,tax:10001}).success,false);
  assert.equal(quoteInputSchema.safeParse({...input,lines:[{...input.lines[0],quantity:0}]}).success,false);
  assert.equal(quoteInputSchema.safeParse({...input,lines:[{...input.lines[0],unitPrice:-1}]}).success,false);
  assert.throws(()=>calculateQuote({...input,discount:9999999}),/exceeds/);
  assert.equal(formatQuoteMoney(10500,"JPY",0),"JPY\u00a010,500");
  assert.match(formatQuoteMoney(10500,"EUR",2),/EUR.*105\.00/);
});

test("public projection never includes costs or private notes", () => {
  const input=sample();
  input.privateNotes="Private note sentinel";
  input.lines[0].cost=123456;
  input.costs.contractors=3000;
  const result=publicQuotation({input,number:"AXN-QT-2026-0001",revision:2,status:"sent",digits:2,
    branding:{...DEFAULT_QUOTE_SETTINGS,taxId:"unverified-tax-id"}});
  const json=JSON.stringify(result);
  assert.doesNotMatch(json,/Private note sentinel|123456|"cost"|"profit"|"margin"|unverified-tax-id/);
  assert.equal(result.revision,2);
  assert.equal(result.oneTime.total,3500000);
});
