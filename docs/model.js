(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.ReostatosModel=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const IDS=["11","12"];
  const sum=values=>values.reduce((a,b)=>a+b,0);
  const parallel=values=>1/sum(values.map(value=>1/value));
  const validPositive=value=>Number.isFinite(value)&&value>0;

  function dimension({VA,VB,RcA,RcB,currents}){
    if(!validPositive(VA)||!validPositive(VB)||!Number.isFinite(RcA)||RcA<0||!Number.isFinite(RcB)||RcB<0||IDS.some(id=>!validPositive(currents[id])))throw new Error("invalid-input");
    const voltages={11:VA-currents[11]*RcA,12:VB-currents[12]*RcB};
    const exhausted=IDS.filter(id=>voltages[id]<=0);
    if(exhausted.length){const error=new Error("voltage-exhausted");error.injections=exhausted.map(id=>id==="11"?"A":"B");throw error}
    const fixed={11:voltages[11]/currents[11],12:voltages[12]/currents[12]};
    return {VA,VB,RcA,RcB,currents:{...currents},voltages,fixed};
  }

  function simulate({V,Rc1,fixed,rheostats}){
    if(!Number.isFinite(V)||V<0||!Number.isFinite(Rc1)||Rc1<0)throw new Error("invalid-input");
    const branch=Object.fromEntries(IDS.map(id=>[id,Number(fixed[id])+Math.max(0,Number(rheostats[id])||0)]));
    if(IDS.some(id=>!validPositive(branch[id])))throw new Error("invalid-resistance");
    const req=parallel(IDS.map(id=>branch[id])),Rt=Rc1+req,It=V/Rt,V1=V-It*Rc1,currents=Object.fromEntries(IDS.map(id=>[id,V1/branch[id]]));
    const pCable=It**2*Rc1,pBranches=sum(IDS.map(id=>currents[id]**2*branch[id])),pSource=V*It;
    return {V,Rc1,fixed:{...fixed},rheostats:{...rheostats},branch,req,Rt,It,V1,currents,pCable,pBranches,pSource,pError:pSource-pCable-pBranches};
  }

  function adjust({V,Rc1,fixed,targets,maxReo}){
    if(!validPositive(V)||!Number.isFinite(Rc1)||Rc1<0||!validPositive(maxReo)||IDS.some(id=>!validPositive(targets[id])))throw new Error("invalid-target");
    const It=sum(IDS.map(id=>targets[id])),V1=V-It*Rc1;
    if(V1<=0)return {feasible:false,reason:"voltage",It,V1};
    const rheostats=Object.fromEntries(IDS.map(id=>[id,V1/targets[id]-fixed[id]])),negative=IDS.filter(id=>rheostats[id]<-1e-8),over=IDS.filter(id=>rheostats[id]>maxReo+1e-8);
    return {feasible:negative.length===0&&over.length===0,It,V1,rheostats,negative,over};
  }

  return {IDS,dimension,simulate,adjust};
});
