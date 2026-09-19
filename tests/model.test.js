const assert=require("node:assert/strict");
const model=require("../docs/model.js");
const currents={11:1.2,12:1};
const nominal=model.dimension({VA:24,VB:24,RcA:.4,RcB:.4,currents});
assert.ok(Math.abs(nominal.voltages[11]-23.52)<1e-12);
assert.ok(Math.abs(nominal.voltages[12]-23.6)<1e-12);
assert.ok(Math.abs(nominal.fixed[11]-19.6)<1e-12);
assert.ok(Math.abs(nominal.fixed[12]-23.6)<1e-12);

const zero={11:0,12:0};
const operating=model.simulate({V:24,Rc1:.4,fixed:nominal.fixed,rheostats:zero});
assert.ok(Math.abs(operating.It-operating.currents[11]-operating.currents[12])<1e-12);
assert.ok(Math.abs(operating.V-operating.V1-operating.It*operating.Rc1)<1e-12);
assert.ok(Math.abs(operating.pError)<1e-10);

const throttled=model.simulate({V:24,Rc1:.4,fixed:nominal.fixed,rheostats:{11:10,12:0}});
assert.ok(throttled.currents[11]<operating.currents[11]);
const edited=model.simulate({V:24,Rc1:.4,fixed:{...nominal.fixed,12:nominal.fixed[12]+5},rheostats:zero});
assert.ok(edited.currents[12]<operating.currents[12]);

const targets={11:1,12:.8};
const adjustment=model.adjust({V:24,Rc1:.4,fixed:nominal.fixed,targets,maxReo:100});
assert.equal(adjustment.feasible,true);
const adjusted=model.simulate({V:24,Rc1:.4,fixed:nominal.fixed,rheostats:adjustment.rheostats});
for(const id of model.IDS)assert.ok(Math.abs(adjusted.currents[id]-targets[id])<1e-12,`objetivo ${id}`);
assert.throws(()=>model.dimension({VA:.1,VB:24,RcA:1,RcB:.4,currents}),error=>error.message==="voltage-exhausted"&&error.injections.includes("A"));
assert.throws(()=>model.dimension({VA:24,VB:.1,RcA:.4,RcB:1,currents}),error=>error.message==="voltage-exhausted"&&error.injections.includes("B"));
const impossible=model.adjust({V:24,Rc1:.4,fixed:nominal.fixed,targets:{11:1.5,12:1.2},maxReo:100});
assert.equal(impossible.feasible,false);assert.ok(impossible.negative.length>0);
console.log("Pruebas del modelo de dos inyecciones: correctas");
