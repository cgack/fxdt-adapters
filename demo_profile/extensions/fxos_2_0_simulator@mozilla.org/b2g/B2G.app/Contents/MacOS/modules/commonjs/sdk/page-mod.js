"use strict";module.metadata={"stability":"stable"};const observers=require('./system/events');const{contract:loaderContract}=require('./content/loader');const{contract}=require('./util/contract');const{getAttachEventType,WorkerHost}=require('./content/utils');const{Class}=require('./core/heritage');const{Disposable}=require('./core/disposable');const{WeakReference}=require('./core/reference');const{Worker}=require('./content/worker');const{EventTarget}=require('./event/target');const{on,emit,once,setListeners}=require('./event/core');const{on:domOn,removeListener:domOff}=require('./dom/events');const{pipe}=require('./event/utils');const{isRegExp}=require('./lang/type');const{merge}=require('./util/object');const{windowIterator}=require('./deprecated/window-utils');const{isBrowser,getFrames}=require('./window/utils');const{getTabs,getTabContentWindow,getTabForContentWindow,getURI:getTabURI}=require('./tabs/utils');const{ignoreWindow}=require('sdk/private-browsing/utils');const{Style}=require("./stylesheet/style");const{attach,detach}=require("./content/mod");const{has,hasAny}=require("./util/array");const{Rules}=require("./util/rules");const{List,addListItem,removeListItem}=require('./util/list');const{when:unload}=require("./system/unload");const VALID_ATTACHTO_OPTIONS=['existing','top','frame'];const pagemods=new Set();const workers=new WeakMap();const styles=new WeakMap();const models=new WeakMap();let modelFor=(mod)=>models.get(mod);let workerFor=(mod)=>workers.get(mod);let styleFor=(mod)=>styles.get(mod);observers.on('document-element-inserted',onContentWindow);unload(()=>observers.off('document-element-inserted',onContentWindow));let isRegExpOrString=(v)=>isRegExp(v)||typeof v==='string';const modOptions={contentStyle:merge(Object.create(loaderContract.rules.contentScript),{msg:'The `contentStyle` option must be a string or an array of strings.'}),contentStyleFile:merge(Object.create(loaderContract.rules.contentScriptFile),{msg:'The `contentStyleFile` option must be a local URL or an array of URLs'}),include:{is:['string','array','regexp'],ok:(rule)=>{if(isRegExpOrString(rule))
return true;if(Array.isArray(rule)&&rule.length>0)
return rule.every(isRegExpOrString);return false;},msg:'The `include` option must always contain atleast one rule as a string, regular expression, or an array of strings and regular expressions.'},attachTo:{is:['string','array','undefined'],map:function(attachTo){if(!attachTo)return['top','frame'];if(typeof attachTo==='string')return[attachTo];return attachTo;},ok:function(attachTo){return hasAny(attachTo,['top','frame'])&&attachTo.every(has.bind(null,['top','frame','existing']));},msg:'The `attachTo` option must be a string or an array of strings. '+'The only valid options are "existing", "top" and "frame", and must '+'contain at least "top" or "frame" values.'},};const modContract=contract(merge({},loaderContract.rules,modOptions));const PageMod=Class({implements:[modContract.properties(modelFor),EventTarget,Disposable,WeakReference],extends:WorkerHost(workerFor),setup:function PageMod(options){let mod=this;let model=modContract(options);models.set(this,model);setListeners(this,options);let include=model.include;model.include=Rules();model.include.add.apply(model.include,[].concat(include));if(model.contentStyle||model.contentStyleFile){styles.set(mod,Style({uri:model.contentStyleFile,source:model.contentStyle}));}
pagemods.add(this);if(has(model.attachTo,'existing'))
applyOnExistingDocuments(mod);},dispose:function(){let style=styleFor(this);if(style)
detach(style);for(let i in this.include)
this.include.remove(this.include[i]);pagemods.delete(this);}});exports.PageMod=PageMod;function onContentWindow({subject:document}){ if(pagemods.size===0)
return;let window=document.defaultView;if(!window)
return; if(!getTabForContentWindow(window))
return;
 if(ignoreWindow(window))
return;for(let pagemod of pagemods){if(pagemod.include.matchesAny(document.URL))
onContent(pagemod,window);}}
function getAllTabs(){let tabs=[]; for(let window in windowIterator()){if(!isBrowser(window))
continue;tabs=tabs.concat(getTabs(window));}
return tabs;}
function applyOnExistingDocuments(mod){let tabs=getAllTabs();tabs.forEach(function(tab){ let window=getTabContentWindow(tab);if(has(mod.attachTo,"top")&&mod.include.matchesAny(getTabURI(tab)))
onContent(mod,window);if(has(mod.attachTo,"frame")){getFrames(window).filter((iframe)=>mod.include.matchesAny(iframe.location.href)).forEach((frame)=>onContent(mod,frame));}});}
function createWorker(mod,window){let worker=Worker({window:window,contentScript:mod.contentScript,contentScriptFile:mod.contentScriptFile,contentScriptOptions:mod.contentScriptOptions,

onError:(e)=>emit(mod,'error',e)});workers.set(mod,worker);pipe(worker,mod);emit(mod,'attach',worker);once(worker,'detach',function detach(){worker.destroy();});}
function onContent(mod,window){ if(!pagemods.has(mod))
return;let isTopDocument=window.top===window; if(isTopDocument&&!has(mod.attachTo,"top"))
return; if(!isTopDocument&&!has(mod.attachTo,"frame"))
return;let style=styleFor(mod);if(style)
attach(style,window);
 if(isMatchingAttachState(mod,window)){createWorker(mod,window);return;}
let eventName=getAttachEventType(mod)||'load';domOn(window,eventName,function onReady(e){if(e.target.defaultView!==window)
return;domOff(window,eventName,onReady,true);createWorker(mod,window);},true);}
function isMatchingAttachState(mod,window){let state=window.document.readyState;return'start'===mod.contentScriptWhen||'complete'===state||('ready'===mod.contentScriptWhen&&state==='interactive')}