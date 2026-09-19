const ids=["11","12"];
const state={fixed:null,nominal:null,op:null};
const $=id=>document.getElementById(id);
const n=id=>Number($(id).value);
const fmt=(value,digits=3)=>Number.isFinite(value)?value.toLocaleString("es-EC",{minimumFractionDigits:digits,maximumFractionDigits:digits}):"—";
const powerFmt=value=>Number.isFinite(value)?value.toFixed(2):"—";
const fixedInputs=()=>Object.fromEntries(ids.map(id=>[id,n("system-r-"+id)]));

function buildBranches(){
  const defaults={11:1.2,12:1};
  $("branch-cards").innerHTML=ids.map(id=>`
    <article class="panel branch tone-${id}" data-id="${id}">
      <div class="branch-head"><div><span>NODO 1</span><h3>RAMA ${id}</h3></div><div class="amp" id="amp-${id}">— A</div></div>
      <div class="branch-inputs">
        <label><span class="input-title">Corriente</span><input id="target-${id}" type="number" min="0.001" step="0.01" value="${defaults[id]}"><em>A</em></label>
        <label><span class="input-title"><span>Reo${id}</span><strong id="reo-power-${id}">0.00 W</strong></span><input id="reo-${id}" type="number" min="0" max="10000" step="0.01" value="0"><em>Ω</em></label>
      </div>
      <div class="fixed-note"><span>Resistencia del Sistema R${id}</span><label class="fixed-control"><input id="system-r-${id}" aria-label="Resistencia del Sistema R${id}" type="number" min="0.01" step="0.01"><em>Ω</em></label></div>
    </article>`).join("");
}

function calibrationInput(){return {VA:n("nom-va"),VB:n("nom-vb"),RcA:n("rca"),RcB:n("rcb"),currents:{11:n("nom-i11"),12:n("nom-i12")}}}
function persist(){localStorage.setItem("reostato-1-rama-1iny-uni-fixed",JSON.stringify({fixed:state.fixed,nominal:state.nominal,operationCable:n("live-rc1")}))}

function computeFixed(){
  const input=calibrationInput();let result;
  try{result=ReostatosModel.dimension(input)}catch(error){
    if(error.message==="voltage-exhausted")showMessage("La caída en el cable consume la tensión disponible en la inyección "+error.injections.join(" y ")+". Reduzca la corriente o la resistencia del cable, o aumente el voltaje.","error");
    else showMessage("Revise los datos: los voltajes y las corrientes deben ser mayores que cero; las resistencias de cable no pueden ser negativas.","error");
    return null;
  }
  state.fixed=result.fixed;state.nominal=result;
  ids.forEach(id=>{$("fixed-r"+id).textContent=fmt(result.fixed[id],2)+" Ω";$("system-r-"+id).value=result.fixed[id].toFixed(2);$("target-"+id).value=result.currents[id];setRheostat(id,0)});
  $("fixed-nodes").textContent="A: "+fmt(result.voltages[11],2)+" V · B: "+fmt(result.voltages[12],2)+" V";
  persist();solve();showMessage("R11 y R12 fueron calculadas con sus inyecciones independientes y transferidas a Regulación.","success");return result;
}

function solve(){
  if(!state.fixed||!state.nominal)return null;
  const fixed=fixedInputs();if(ids.some(id=>!Number.isFinite(fixed[id])||fixed[id]<=0)){showMessage("Las resistencias del sistema deben ser mayores que cero.","error");return null}
  state.fixed=fixed;const rheostats=Object.fromEntries(ids.map(id=>[id,Math.max(0,n("reo-"+id)||0)]));
  try{state.op=ReostatosModel.simulate({V:n("live-v"),Rc1:n("live-rc1"),fixed:state.fixed,rheostats});render();persist();return state.op}catch{showMessage("La simulación contiene un valor no válido.","error");return null}
}

function render(){
  const o=state.op,tolerance=Math.max(.01,n("tolerance")||2);let allWithin=true;
  $("live-v-out").textContent=fmt(o.V,2)+" V";$("head-current").textContent=fmt(o.It)+" A";$("health-dot").className="health-dot ok";
  ids.forEach(id=>{const target=n("target-"+id),pct=target>0?100*(o.currents[id]-target)/target:NaN;allWithin&&=Number.isFinite(pct)&&Math.abs(pct)<=tolerance;$("amp-"+id).textContent=fmt(o.currents[id])+" A";$("reo-power-"+id).textContent=powerFmt(o.currents[id]**2*o.rheostats[id])+" W"});
  $("health-label").textContent=allWithin?"Objetivos cumplidos":"Simulación válida";$("res-it").textContent=fmt(o.It)+" A";$("res-v1").textContent=fmt(o.V1,3)+" V";$("res-dv1").textContent=fmt(o.It*o.Rc1,3)+" V";$("res-ps").textContent=fmt(o.pSource,2)+" W";$("res-pd").textContent=fmt(o.pCable+o.pBranches,2)+" W";$("res-pe").textContent=fmt(o.pError,8)+" W";renderDiagram(o);
  $("results-body").innerHTML=ids.map(id=>{const target=n("target-"+id),pct=target>0?100*(o.currents[id]-target)/target:NaN,power=o.currents[id]**2*o.branch[id];return `<tr><td>I${id}</td><td>${fmt(o.currents[id])} A</td><td>${fmt(target)} A</td><td class="${Math.abs(pct)<=tolerance?"status-ok":"status-warn"}">${Number.isFinite(pct)?fmt(pct,2)+" %":"—"}</td><td>${fmt(state.fixed[id],2)} Ω</td><td>${fmt(o.rheostats[id])} Ω</td><td>${fmt(power,2)} W</td></tr>`}).join("");
  const errors={"KCL nodo 1":o.It-o.currents[11]-o.currents[12],"KVL fuente–nodo 1":o.V-o.V1-o.It*o.Rc1,"Balance de potencia":o.pError};
  $("checks").innerHTML=Object.entries(errors).map(([label,value])=>`<p><span>${label}</span><b>${fmt(value,8)}</b></p>`).join("");
}

function renderDiagram(o){
  $("diag-v").textContent=fmt(o.V,2)+" V";$("diag-it").textContent="It "+fmt(o.It)+" A";$("diag-rc1").textContent=fmt(o.Rc1,2)+" Ω";$("diag-dv1").textContent="ΔV "+fmt(o.It*o.Rc1,3)+" V";$("diag-v1").textContent=fmt(o.V1,3)+" V";
  ids.forEach(id=>{$("diag-i"+id).textContent="I"+id+" "+fmt(o.currents[id])+" A";$("diag-r"+id).textContent=fmt(o.fixed[id],2)+" Ω";$("diag-reo"+id).textContent=fmt(o.rheostats[id],2)+" Ω";$("diag-p"+id).textContent=powerFmt(o.currents[id]**2*o.rheostats[id])+" W"});
  $("diag-card-v").textContent=fmt(o.V,2)+" V";$("diag-card-it").textContent=fmt(o.It)+" A";$("diag-card-v1").textContent=fmt(o.V1,3)+" V";$("diag-card-pc").textContent=fmt(o.pCable,2)+" W";
}

function setRheostat(id,value){$("reo-"+id).value=Math.round(Math.max(0,value)*1000)/1000}
function assistedAdjustment(){
  if(!state.fixed){showMessage("Calcule primero las resistencias del sistema.","error");return null}
  const targets=Object.fromEntries(ids.map(id=>[id,n("target-"+id)])),input={V:n("live-v"),Rc1:n("live-rc1"),fixed:state.fixed,targets,maxReo:n("reo-max")};let result;
  try{result=ReostatosModel.adjust(input)}catch{showMessage("Las corrientes y el reóstato máximo deben ser mayores que cero.","error");return null}
  if(result.reason==="voltage"){showMessage("La tensión disponible no alcanza para las corrientes solicitadas.","error");return result}
  if(!result.feasible){const parts=[];if(result.negative.length)parts.push("Ramas "+result.negative.join(", ")+": requieren una resistencia negativa");if(result.over.length)parts.push("Ramas "+result.over.join(", ")+": superan el máximo configurado");showMessage("Ajuste no alcanzable. "+parts.join(". ")+".","error");return result}
  ids.forEach(id=>setRheostat(id,result.rheostats[id]));solve();showMessage("Ajuste calculado para una tensión de nodo de "+fmt(result.V1,3)+" V.","success");return result;
}

function caseData(){return {format:"reostato-1-rama-1iny-uni-case",version:1,createdAt:new Date().toISOString(),calibration:{VA:state.nominal.VA,VB:state.nominal.VB,RcA:state.nominal.RcA,RcB:state.nominal.RcB,currents:state.nominal.currents,fixed:state.fixed},operation:{V:n("live-v"),Rc1:n("live-rc1"),targets:Object.fromEntries(ids.map(id=>[id,n("target-"+id)])),rheostats:Object.fromEntries(ids.map(id=>[id,n("reo-"+id)])),rheostatMax:n("reo-max"),tolerancePercent:n("tolerance")},results:state.op}}
function saveCase(){if(!state.op)return;const blob=new Blob([JSON.stringify(caseData(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="reostato-1-rama-1iny-uni-"+new Date().toISOString().slice(0,10)+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function loadCase(file){const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(data.format!=="reostato-1-rama-1iny-uni-case"||!data.calibration?.fixed||!data.operation)throw new Error();const calibration=ReostatosModel.dimension({VA:data.calibration.VA,VB:data.calibration.VB,RcA:data.calibration.RcA,RcB:data.calibration.RcB,currents:data.calibration.currents});state.fixed=data.calibration.fixed;state.nominal=calibration;$("nom-va").value=calibration.VA;$("nom-vb").value=calibration.VB;$("rca").value=calibration.RcA;$("rcb").value=calibration.RcB;ids.forEach(id=>{$("nom-i"+id).value=calibration.currents[id];$("fixed-r"+id).textContent=fmt(state.fixed[id],2)+" Ω";$("system-r-"+id).value=Number(state.fixed[id]).toFixed(2);$("target-"+id).value=data.operation.targets[id];setRheostat(id,data.operation.rheostats[id])});$("fixed-nodes").textContent="A: "+fmt(calibration.voltages[11],2)+" V · B: "+fmt(calibration.voltages[12],2)+" V";$("live-v").value=data.operation.V;$("live-rc1").value=data.operation.Rc1;$("reo-max").value=data.operation.rheostatMax||100;$("tolerance").value=data.operation.tolerancePercent||2;persist();solve();showMessage("Caso importado y recalculado correctamente.","success")}catch{showMessage("El archivo no corresponde a un caso válido de esta aplicación.","error")}};reader.readAsText(file)}

function showMessage(text,type){const element=$("message");element.textContent=text;element.className="message show "+type}
function wireEvents(){$("calculate-fixed").addEventListener("click",computeFixed);$("live-v").addEventListener("input",solve);$("live-rc1").addEventListener("input",solve);ids.forEach(id=>{$("reo-"+id).addEventListener("input",solve);$("target-"+id).addEventListener("input",solve);$("system-r-"+id).addEventListener("input",solve)});$("reset-rheostats").addEventListener("click",()=>{ids.forEach(id=>setRheostat(id,0));solve()});$("assist").addEventListener("click",assistedAdjustment);$("tolerance").addEventListener("input",solve);$("save-case").addEventListener("click",saveCase);$("load-case").addEventListener("click",()=>$("case-file").click());$("case-file").addEventListener("change",event=>{if(event.target.files[0])loadCase(event.target.files[0]);event.target.value=""});$("print-report").addEventListener("click",()=>window.print())}
function restore(){try{const saved=JSON.parse(localStorage.getItem("reostato-1-rama-1iny-uni-fixed"));if(saved?.fixed&&saved?.nominal){state.fixed=saved.fixed;state.nominal=saved.nominal;$("nom-va").value=state.nominal.VA;$("nom-vb").value=state.nominal.VB;$("rca").value=state.nominal.RcA;$("rcb").value=state.nominal.RcB;ids.forEach(id=>{$("nom-i"+id).value=state.nominal.currents[id];$("fixed-r"+id).textContent=fmt(state.fixed[id],2)+" Ω";$("system-r-"+id).value=Number(state.fixed[id]).toFixed(2)});$("fixed-nodes").textContent="A: "+fmt(state.nominal.voltages[11],2)+" V · B: "+fmt(state.nominal.voltages[12],2)+" V";$("live-rc1").value=Number.isFinite(saved.operationCable)?saved.operationCable:.4;solve();return}}catch{}computeFixed()}

function registerWebMcp(){const context=document.modelContext;if(!context?.registerTool)return;try{void Promise.resolve(context.registerTool({name:"calculate_two_injection_resistances",title:"Calcular resistencias con dos inyecciones",description:"Actualiza las dos mediciones de campo visibles. La inyección A calcula R11 y la inyección B calcula R12.",inputSchema:{type:"object",properties:{voltageA:{type:"number",exclusiveMinimum:0},cableResistanceA:{type:"number",minimum:0},current11:{type:"number",exclusiveMinimum:0},voltageB:{type:"number",exclusiveMinimum:0},cableResistanceB:{type:"number",minimum:0},current12:{type:"number",exclusiveMinimum:0}},required:["voltageA","cableResistanceA","current11","voltageB","cableResistanceB","current12"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const values=[input.voltageA,input.cableResistanceA,input.current11,input.voltageB,input.cableResistanceB,input.current12];if(!values.every(Number.isFinite)||input.voltageA<=0||input.cableResistanceA<0||input.current11<=0||input.voltageB<=0||input.cableResistanceB<0||input.current12<=0)throw new Error("Datos de campo no válidos");$("nom-va").value=input.voltageA;$("rca").value=input.cableResistanceA;$("nom-i11").value=input.current11;$("nom-vb").value=input.voltageB;$("rcb").value=input.cableResistanceB;$("nom-i12").value=input.current12;const result=computeFixed();if(!result)throw new Error("No fue posible calcular las resistencias");return {effectiveVoltageA:result.voltages[11],resistance11:result.fixed[11],effectiveVoltageB:result.voltages[12],resistance12:result.fixed[12]}}})).catch(()=>{})}catch{}}

let installPrompt=null;window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("install-app").hidden=false});$("install-app").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install-app").hidden=true});
buildBranches();wireEvents();restore();registerWebMcp();if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
