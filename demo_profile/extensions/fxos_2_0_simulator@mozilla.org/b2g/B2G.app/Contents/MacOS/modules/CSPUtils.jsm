const Cu=Components.utils;const Ci=Components.interfaces;const WARN_FLAG=Ci.nsIScriptError.warningFlag;const ERROR_FLAG=Ci.nsIScriptError.ERROR_FLAG;Cu.import("resource://gre/modules/XPCOMUtils.jsm");Cu.import("resource://gre/modules/Services.jsm");XPCOMUtils.defineLazyModuleGetter(this,"Services","resource://gre/modules/Services.jsm");this.EXPORTED_SYMBOLS=["CSPRep","CSPSourceList","CSPSource","CSPHost","CSPdebug","CSPViolationReportListener","CSPLocalizer","CSPPrefObserver"];var STRINGS_URI="chrome://global/locale/security/csp.properties";var gIoService=Components.classes["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);var gETLDService=Components.classes["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
const R_SCHEME=new RegExp("([a-zA-Z0-9\\-]+)",'i');const R_GETSCHEME=new RegExp("^"+R_SCHEME.source+"(?=\\:)",'i');const R_SCHEMESRC=new RegExp("^"+R_SCHEME.source+"\\:$",'i');const HOSTCHAR="{}a-zA-Z0-9\\-";const R_HOSTCHAR=new RegExp("["+HOSTCHAR+"]",'i');const R_COMP_HCHAR=new RegExp("[^"+HOSTCHAR+"]","i");const R_INV_HCHAR=new RegExp("[^"+HOSTCHAR+"\\.\\*]",'i');const R_HOST=new RegExp("\\*|(((\\*\\.)?"+R_HOSTCHAR.source+"+)"+"(\\."+R_HOSTCHAR.source+"+)*)",'i');const R_PORT=new RegExp("(\\:([0-9]+|\\*))",'i');const R_HOSTSRC=new RegExp("^(("+R_SCHEME.source+"\\:\\/\\/)?("
+R_HOST.source+")"
+R_PORT.source+"?)$",'i');function STRIP_INPUTDELIM(re){return re.replace(/(^\^)|(\$$)/g,"");}
const R_VCHAR_EXCEPT=new RegExp("[!-+--:<-~]");const R_EXTHOSTSRC=new RegExp("^"+STRIP_INPUTDELIM(R_HOSTSRC.source)
+"\\/"
+R_VCHAR_EXCEPT.source+"*$",'i');const R_KEYWORDSRC=new RegExp("^('self'|'unsafe-inline'|'unsafe-eval')$",'i');const R_BASE64=new RegExp("([a-zA-Z0-9+/]+={0,2})");const R_NONCESRC=new RegExp("^'nonce-"+R_BASE64.source+"'$");
const R_HASH_ALGOS=new RegExp("(sha256|sha384|sha512)");const R_HASHSRC=new RegExp("^'"+R_HASH_ALGOS.source+"-"+R_BASE64.source+"'$");const R_SOURCEEXP=new RegExp(R_SCHEMESRC.source+"|"+
R_HOSTSRC.source+"|"+
R_EXTHOSTSRC.source+"|"+
R_KEYWORDSRC.source+"|"+
R_NONCESRC.source+"|"+
R_HASHSRC.source,'i');const R_QUOTELESS_KEYWORDS=new RegExp("^(self|unsafe-inline|unsafe-eval|"+"inline-script|eval-script|none)$",'i');this.CSPPrefObserver={get debugEnabled(){if(!this._branch)
this._initialize();return this._debugEnabled;},get experimentalEnabled(){if(!this._branch)
this._initialize();return this._experimentalEnabled;},_initialize:function(){var prefSvc=Components.classes["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);this._branch=prefSvc.getBranch("security.csp.");this._branch.addObserver("",this,false);this._debugEnabled=this._branch.getBoolPref("debug");this._experimentalEnabled=this._branch.getBoolPref("experimentalEnabled");},unregister:function(){if(!this._branch)return;this._branch.removeObserver("",this);},observe:function(aSubject,aTopic,aData){if(aTopic!="nsPref:changed")return;if(aData==="debug")
this._debugEnabled=this._branch.getBoolPref("debug");if(aData==="experimentalEnabled")
this._experimentalEnabled=this._branch.getBoolPref("experimentalEnabled");},};this.CSPdebug=function CSPdebug(aMsg){if(!CSPPrefObserver.debugEnabled)return;aMsg='CSP debug: '+aMsg+"\n";Components.classes["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).logStringMessage(aMsg);}
function CSPPolicyURIListener(policyURI,docRequest,csp,reportOnly){this._policyURI=policyURI; this._docRequest=docRequest; this._csp=csp; this._policy=""; this._wrapper=null; this._docURI=docRequest.QueryInterface(Ci.nsIChannel).URI;this._reportOnly=reportOnly;}
CSPPolicyURIListener.prototype={QueryInterface:function(iid){if(iid.equals(Ci.nsIStreamListener)||iid.equals(Ci.nsIRequestObserver)||iid.equals(Ci.nsISupports))
return this;throw Components.results.NS_ERROR_NO_INTERFACE;},onStartRequest:function(request,context){},onDataAvailable:function(request,context,inputStream,offset,count){if(this._wrapper==null){this._wrapper=Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);this._wrapper.init(inputStream);} 
this._policy+=this._wrapper.read(count);},onStopRequest:function(request,context,status){if(Components.isSuccessCode(status)){
 this._csp.appendPolicy(this._policy,this._docURI,this._reportOnly,this._csp._specCompliant);}
else{
this._csp.log(WARN_FLAG,CSPLocalizer.getFormatStr("errorFetchingPolicy",[status]));this._csp.appendPolicy("default-src 'none'",this._docURI,this._reportOnly,this._csp._specCompliant);} 
this._docRequest.resume();}};this.CSPRep=function CSPRep(aSpecCompliant){
this._isInitialized=false;this._allowEval=false;this._allowInlineScripts=false;this._reportOnlyMode=false; this._directives={};this._specCompliant=(aSpecCompliant!==undefined)?aSpecCompliant:false;this._allowInlineStyles=!aSpecCompliant;}
CSPRep.SRC_DIRECTIVES_OLD={DEFAULT_SRC:"default-src",SCRIPT_SRC:"script-src",STYLE_SRC:"style-src",MEDIA_SRC:"media-src",IMG_SRC:"img-src",OBJECT_SRC:"object-src",FRAME_SRC:"frame-src",FRAME_ANCESTORS:"frame-ancestors",FONT_SRC:"font-src",XHR_SRC:"xhr-src"};CSPRep.SRC_DIRECTIVES_NEW={DEFAULT_SRC:"default-src",SCRIPT_SRC:"script-src",STYLE_SRC:"style-src",MEDIA_SRC:"media-src",IMG_SRC:"img-src",OBJECT_SRC:"object-src",FRAME_SRC:"frame-src",FRAME_ANCESTORS:"frame-ancestors",FONT_SRC:"font-src",CONNECT_SRC:"connect-src"};CSPRep.URI_DIRECTIVES={REPORT_URI:"report-uri",POLICY_URI:"policy-uri"};

CSPRep.OPTIONS_DIRECTIVE="options";CSPRep.ALLOW_DIRECTIVE="allow";CSPRep.fromString=function(aStr,self,reportOnly,docRequest,csp,enforceSelfChecks){var SD=CSPRep.SRC_DIRECTIVES_OLD;var UD=CSPRep.URI_DIRECTIVES;var aCSPR=new CSPRep();aCSPR._originalText=aStr;aCSPR._innerWindowID=innerWindowFromRequest(docRequest);if(typeof reportOnly==='undefined')reportOnly=false;aCSPR._reportOnlyMode=reportOnly;var selfUri=null;if(self instanceof Ci.nsIURI){selfUri=self.cloneIgnoringRef();
try{ selfUri.userPass='';}catch(ex){}}
var dirs=aStr.split(";");directive:for each(var dir in dirs){dir=dir.trim();if(dir.length<1)continue;var dirname=dir.split(/\s+/)[0].toLowerCase();var dirvalue=dir.substring(dirname.length).trim();if(aCSPR._directives.hasOwnProperty(dirname)){ cspError(aCSPR,CSPLocalizer.getFormatStr("duplicateDirective",[dirname]));CSPdebug("Skipping duplicate directive: \""+dir+"\"");continue directive;}
if(dirname===CSPRep.OPTIONS_DIRECTIVE){if(aCSPR._allowInlineScripts||aCSPR._allowEval){ cspError(aCSPR,CSPLocalizer.getFormatStr("duplicateDirective",[dirname]));CSPdebug("Skipping duplicate directive: \""+dir+"\"");continue directive;} 
var options=dirvalue.split(/\s+/);for each(var opt in options){if(opt==="inline-script")
aCSPR._allowInlineScripts=true;else if(opt==="eval-script")
aCSPR._allowEval=true;else
cspWarn(aCSPR,CSPLocalizer.getFormatStr("ignoringUnknownOption",[opt]));}
continue directive;}

if(dirname===CSPRep.ALLOW_DIRECTIVE){cspWarn(aCSPR,CSPLocalizer.getStr("allowDirectiveIsDeprecated"));if(aCSPR._directives.hasOwnProperty(SD.DEFAULT_SRC)){ cspError(aCSPR,CSPLocalizer.getFormatStr("duplicateDirective",[dirname]));CSPdebug("Skipping duplicate directive: \""+dir+"\"");continue directive;}
var dv=CSPSourceList.fromString(dirvalue,aCSPR,selfUri,enforceSelfChecks);if(dv){aCSPR._directives[SD.DEFAULT_SRC]=dv;continue directive;}}
for each(var sdi in SD){if(dirname===sdi){var dv=CSPSourceList.fromString(dirvalue,aCSPR,selfUri,enforceSelfChecks);if(dv){aCSPR._directives[sdi]=dv;continue directive;}}}
if(dirname===UD.REPORT_URI){ var uriStrings=dirvalue.split(/\s+/);var okUriStrings=[];for(let i in uriStrings){var uri=null;try{
uri=gIoService.newURI(uriStrings[i],null,selfUri);
uri.host;


if(!uri.schemeIs("http")&&!uri.schemeIs("https")){cspWarn(aCSPR,CSPLocalizer.getFormatStr("reportURInotHttpsOrHttp2",[uri.asciiSpec]));}}catch(e){switch(e.result){case Components.results.NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS:case Components.results.NS_ERROR_HOST_IS_IP_ADDRESS:if(uri.host!==selfUri.host){cspWarn(aCSPR,CSPLocalizer.getFormatStr("pageCannotSendReportsTo",[selfUri.host,uri.host]));continue;}
break;default:cspWarn(aCSPR,CSPLocalizer.getFormatStr("couldNotParseReportURI",[uriStrings[i]]));continue;}} 
okUriStrings.push(uri.asciiSpec);}
aCSPR._directives[UD.REPORT_URI]=okUriStrings.join(' ');continue directive;}
if(dirname===UD.POLICY_URI){ if(aCSPR._directives.length>0||dirs.length>1){cspError(aCSPR,CSPLocalizer.getStr("policyURINotAlone"));return CSPRep.fromString("default-src 'none'",null,reportOnly);}
 
if(!docRequest||!csp){cspError(aCSPR,CSPLocalizer.getStr("noParentRequest"));return CSPRep.fromString("default-src 'none'",null,reportOnly);}
var uri='';try{uri=gIoService.newURI(dirvalue,null,selfUri);}catch(e){cspError(aCSPR,CSPLocalizer.getFormatStr("policyURIParseError",[dirvalue]));return CSPRep.fromString("default-src 'none'",null,reportOnly);} 
if(selfUri){if(selfUri.host!==uri.host){cspError(aCSPR,CSPLocalizer.getFormatStr("nonMatchingHost",[uri.host]));return CSPRep.fromString("default-src 'none'",null,reportOnly);}
if(selfUri.port!==uri.port){cspError(aCSPR,CSPLocalizer.getFormatStr("nonMatchingPort",[uri.port.toString()]));return CSPRep.fromString("default-src 'none'",null,reportOnly);}
if(selfUri.scheme!==uri.scheme){cspError(aCSPR,CSPLocalizer.getFormatStr("nonMatchingScheme",[uri.scheme]));return CSPRep.fromString("default-src 'none'",null,reportOnly);}} 
try{docRequest.suspend();var chan=gIoService.newChannel(uri.asciiSpec,null,null);
 chan.loadFlags|=Ci.nsIChannel.LOAD_ANONYMOUS;chan.loadGroup=docRequest.loadGroup;chan.asyncOpen(new CSPPolicyURIListener(uri,docRequest,csp,reportOnly),null);}
catch(e){ docRequest.resume();cspError(aCSPR,CSPLocalizer.getFormatStr("errorFetchingPolicy",[e.toString()]));return CSPRep.fromString("default-src 'none'",null,reportOnly);}

return CSPRep.fromString("default-src *",null,reportOnly);}
cspWarn(aCSPR,CSPLocalizer.getFormatStr("couldNotProcessUnknownDirective",[dirname]));}


if(!aCSPR._directives[SD.DEFAULT_SRC]){cspWarn(aCSPR,CSPLocalizer.getStr("allowOrDefaultSrcRequired"));return CSPRep.fromString("default-src 'none'",null,reportOnly);}


if(aCSPR._reportOnlyMode&&!aCSPR._directives.hasOwnProperty(UD.REPORT_URI)){cspWarn(aCSPR,CSPLocalizer.getFormatStr("reportURInotInReportOnlyHeader",[selfUri?selfUri.prePath:"undefined"]))}
return aCSPR;};
CSPRep.fromStringSpecCompliant=function(aStr,self,reportOnly,docRequest,csp,enforceSelfChecks){var SD=CSPRep.SRC_DIRECTIVES_NEW;var UD=CSPRep.URI_DIRECTIVES;var aCSPR=new CSPRep(true);aCSPR._originalText=aStr;aCSPR._innerWindowID=innerWindowFromRequest(docRequest);if(typeof reportOnly==='undefined')reportOnly=false;aCSPR._reportOnlyMode=reportOnly;var selfUri=null;if(self instanceof Ci.nsIURI){selfUri=self.cloneIgnoringRef();
try{ selfUri.userPass='';}catch(ex){}}
var dirs_list=aStr.split(";");var dirs={};for each(var dir in dirs_list){dir=dir.trim();if(dir.length<1)continue;var dirname=dir.split(/\s+/)[0].toLowerCase();var dirvalue=dir.substring(dirname.length).trim();dirs[dirname]=dirvalue;}
 
aCSPR._allowEval=true;aCSPR._allowInlineScripts=true;aCSPR._allowInlineStyles=true;

if("default-src"in dirs){ var defaultSrcValue=CSPSourceList.fromString(dirs["default-src"],null,self);if(!defaultSrcValue._allowUnsafeInline){aCSPR._allowInlineScripts=false;aCSPR._allowInlineStyles=false;}
if(!defaultSrcValue._allowUnsafeEval){aCSPR._allowEval=false;}}
if("script-src"in dirs){aCSPR._allowInlineScripts=false;aCSPR._allowEval=false;}
if("style-src"in dirs){aCSPR._allowInlineStyles=false;}
directive:for(var dirname in dirs){var dirvalue=dirs[dirname];if(aCSPR._directives.hasOwnProperty(dirname)){ cspError(aCSPR,CSPLocalizer.getFormatStr("duplicateDirective",[dirname]));CSPdebug("Skipping duplicate directive: \""+dir+"\"");continue directive;}
for each(var sdi in SD){if(dirname===sdi){var dv=CSPSourceList.fromString(dirvalue,aCSPR,self,enforceSelfChecks);if(dv){ if(sdi==="style-src"&&dv._allowUnsafeInline){aCSPR._allowInlineStyles=true;}else if(sdi==="script-src"){ if(dv._allowUnsafeInline){aCSPR._allowInlineScripts=true;}
if(dv._allowUnsafeEval){aCSPR._allowEval=true;}}
aCSPR._directives[sdi]=dv;continue directive;}}}
if(dirname===UD.REPORT_URI){ var uriStrings=dirvalue.split(/\s+/);var okUriStrings=[];for(let i in uriStrings){var uri=null;try{
uri=gIoService.newURI(uriStrings[i],null,selfUri);
uri.host;


if(!uri.schemeIs("http")&&!uri.schemeIs("https")){cspWarn(aCSPR,CSPLocalizer.getFormatStr("reportURInotHttpsOrHttp2",[uri.asciiSpec]));}}catch(e){switch(e.result){case Components.results.NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS:case Components.results.NS_ERROR_HOST_IS_IP_ADDRESS:if(uri.host!==selfUri.host){cspWarn(aCSPR,CSPLocalizer.getFormatStr("pageCannotSendReportsTo",[selfUri.host,uri.host]));continue;}
break;default:cspWarn(aCSPR,CSPLocalizer.getFormatStr("couldNotParseReportURI",[uriStrings[i]]));continue;}}
okUriStrings.push(uri.asciiSpec);}
aCSPR._directives[UD.REPORT_URI]=okUriStrings.join(' ');continue directive;}
if(dirname===UD.POLICY_URI){ if(aCSPR._directives.length>0||dirs.length>1){cspError(aCSPR,CSPLocalizer.getStr("policyURINotAlone"));return CSPRep.fromStringSpecCompliant("default-src 'none'",null,reportOnly);}
 
if(!docRequest||!csp){cspError(aCSPR,CSPLocalizer.getStr("noParentRequest"));return CSPRep.fromStringSpecCompliant("default-src 'none'",null,reportOnly);}
var uri='';try{uri=gIoService.newURI(dirvalue,null,selfUri);}catch(e){cspError(aCSPR,CSPLocalizer.getFormatStr("policyURIParseError",[dirvalue]));return CSPRep.fromStringSpecCompliant("default-src 'none'",null,reportOnly);} 
if(selfUri){if(selfUri.host!==uri.host){cspError(aCSPR,CSPLocalizer.getFormatStr("nonMatchingHost",[uri.host]));return CSPRep.fromStringSpecCompliant("default-src 'none'",null,reportOnly);}
if(selfUri.port!==uri.port){cspError(aCSPR,CSPLocalizer.getFormatStr("nonMatchingPort",[uri.port.toString()]));return CSPRep.fromStringSpecCompliant("default-src 'none'",null,reportOnly);}
if(selfUri.scheme!==uri.scheme){cspError(aCSPR,CSPLocalizer.getFormatStr("nonMatchingScheme",[uri.scheme]));return CSPRep.fromStringSpecCompliant("default-src 'none'",null,reportOnly);}} 
try{docRequest.suspend();var chan=gIoService.newChannel(uri.asciiSpec,null,null);
 chan.loadFlags|=Components.interfaces.nsIChannel.LOAD_ANONYMOUS;chan.loadGroup=docRequest.loadGroup;chan.asyncOpen(new CSPPolicyURIListener(uri,docRequest,csp,reportOnly),null);}
catch(e){ docRequest.resume();cspError(aCSPR,CSPLocalizer.getFormatStr("errorFetchingPolicy",[e.toString()]));return CSPRep.fromStringSpecCompliant("default-src 'none'",null,reportOnly);}
 
return CSPRep.fromStringSpecCompliant("default-src *",null,reportOnly);}
cspWarn(aCSPR,CSPLocalizer.getFormatStr("couldNotProcessUnknownDirective",[dirname]));}



if(aCSPR._reportOnlyMode&&!aCSPR._directives.hasOwnProperty(UD.REPORT_URI)){cspWarn(aCSPR,CSPLocalizer.getFormatStr("reportURInotInReportOnlyHeader",[selfUri?selfUri.prePath:"undefined"]));}
return aCSPR;};CSPRep.prototype={getReportURIs:function(){if(!this._directives[CSPRep.URI_DIRECTIVES.REPORT_URI])
return"";return this._directives[CSPRep.URI_DIRECTIVES.REPORT_URI];},equals:function(that){if(this._directives.length!=that._directives.length){return false;}
for(var i in this._directives){if(!that._directives[i]||!this._directives[i].equals(that._directives[i])){return false;}}
return(this.allowsInlineScripts===that.allowsInlineScripts)&&(this.allowsEvalInScripts===that.allowsEvalInScripts)&&(this.allowsInlineStyles===that.allowsInlineStyles);},toString:function csp_toString(){var dirs=[];if(!this._specCompliant&&(this._allowEval||this._allowInlineScripts)){dirs.push("options"+(this._allowEval?" eval-script":"")
+(this._allowInlineScripts?" inline-script":""));}
for(var i in this._directives){if(this._directives[i]){dirs.push(i+" "+this._directives[i].toString());}}
return dirs.join("; ");},permitsNonce:function csp_permitsNonce(aNonce,aDirective){if(!this._directives.hasOwnProperty(aDirective))return false;return this._directives[aDirective]._sources.some(function(source){return source instanceof CSPNonceSource&&source.permits(aNonce);});},permitsHash:function csp_permitsHash(aContent,aDirective){if(!this._directives.hasOwnProperty(aDirective))return false;return this._directives[aDirective]._sources.some(function(source){return source instanceof CSPHashSource&&source.permits(aContent);});},permits:function csp_permits(aURI,aDirective){if(!aURI)return false; if(aURI instanceof String&&aURI.substring(0,6)==="about:")
return true;if(aURI instanceof Ci.nsIURI&&aURI.scheme==="about")
return true; let DIRS=this._specCompliant?CSPRep.SRC_DIRECTIVES_NEW:CSPRep.SRC_DIRECTIVES_OLD;let directiveInPolicy=false;for(var i in DIRS){if(DIRS[i]===aDirective){directiveInPolicy=true;if(this._directives.hasOwnProperty(aDirective)){return this._directives[aDirective].permits(aURI);} 
break;}}
if(aDirective===DIRS.FRAME_ANCESTORS)
return true;
if(!directiveInPolicy){
CSPdebug("permits called with invalid load type: "+aDirective);return false;}


if(this._directives.hasOwnProperty(DIRS.DEFAULT_SRC)){return this._directives[DIRS.DEFAULT_SRC].permits(aURI);}

return this._specCompliant;},get allowsEvalInScripts(){return this._allowEval;},get allowsInlineScripts(){return this._allowInlineScripts;},get allowsInlineStyles(){return this._allowInlineStyles;},log:function cspd_log(aFlag,aMsg,aSource,aScriptLine,aLineNum){var textMessage="Content Security Policy: "+aMsg;var consoleMsg=Components.classes["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);if(this._innerWindowID){consoleMsg.initWithWindowID(textMessage,aSource,aScriptLine,aLineNum,0,aFlag,"CSP",this._innerWindowID);}else{consoleMsg.init(textMessage,aSource,aScriptLine,aLineNum,0,aFlag,"CSP");}
Components.classes["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService).logMessage(consoleMsg);},};this.CSPSourceList=function CSPSourceList(){this._sources=[];this._permitAllSources=false;this._allowUnsafeInline=false;this._allowUnsafeEval=false; this._hasNonceSource=false; this._hasHashSource=false;}
CSPSourceList.fromString=function(aStr,aCSPRep,self,enforceSelfChecks){
if(self&&!(self instanceof CSPSource)){self=CSPSource.create(self,aCSPRep);}
var slObj=new CSPSourceList();slObj._CSPRep=aCSPRep;aStr=aStr.trim(); if(aStr.toLowerCase()==="'none'"){slObj._permitAllSources=false;return slObj;}
var tokens=aStr.split(/\s+/);for(var i in tokens){if(!R_SOURCEEXP.test(tokens[i])){cspWarn(aCSPRep,CSPLocalizer.getFormatStr("failedToParseUnrecognizedSource",[tokens[i]]));continue;}
var src=CSPSource.create(tokens[i],aCSPRep,self,enforceSelfChecks);if(!src){cspWarn(aCSPRep,CSPLocalizer.getFormatStr("failedToParseUnrecognizedSource",[tokens[i]]));continue;}
if(src._allowUnsafeInline)
slObj._allowUnsafeInline=true;if(src._allowUnsafeEval)
slObj._allowUnsafeEval=true;if(src instanceof CSPNonceSource)
slObj._hasNonceSource=true;if(src instanceof CSPHashSource)
slObj._hasHashSource=true; if(src.permitAll){slObj._permitAllSources=true;}else{slObj._sources.push(src);}}
return slObj;};CSPSourceList.prototype={equals:function(that){
if(that._permitAllSources!=this._permitAllSources){return false;}
if(that._sources.length!=this._sources.length){return false;}
 
var sortfn=function(a,b){return a.toString.toLowerCase()>b.toString.toLowerCase();};var a_sorted=this._sources.sort(sortfn);var b_sorted=that._sources.sort(sortfn);for(var i in a_sorted){if(!a_sorted[i].equals(b_sorted[i])){return false;}}
return true;},toString:function(){if(this.isNone()){return"'none'";}
if(this._permitAllSources){return"*";}
return this._sources.map(function(x){return x.toString();}).join(" ");},isNone:function(){return(!this._permitAllSources)&&(this._sources.length<1);},isAll:function(){return this._permitAllSources;},clone:function(){var aSL=new CSPSourceList();aSL._permitAllSources=this._permitAllSources;aSL._CSPRep=this._CSPRep;for(var i in this._sources){aSL._sources[i]=this._sources[i].clone();}
return aSL;},permits:function cspsd_permits(aURI){if(this.isNone())return false;if(this.isAll())return true;for(var i in this._sources){if(this._sources[i].permits(aURI)){return true;}}
return false;}}
this.CSPSource=function CSPSource(){this._scheme=undefined;this._port=undefined;this._host=undefined; this._permitAll=false;this._isSelf=false; this._allowUnsafeInline=false; this._allowUnsafeEval=false;}
CSPSource.create=function(aData,aCSPRep,self,enforceSelfChecks){if(typeof aData==='string')
return CSPSource.fromString(aData,aCSPRep,self,enforceSelfChecks);if(aData instanceof Ci.nsIURI){
let cleanedUri=aData.cloneIgnoringRef();try{ cleanedUri.userPass='';}catch(ex){}
return CSPSource.fromURI(cleanedUri,aCSPRep,self,enforceSelfChecks);}
if(aData instanceof CSPSource){var ns=aData.clone();ns._self=CSPSource.create(self);return ns;}
return null;}
CSPSource.fromURI=function(aURI,aCSPRep,self,enforceSelfChecks){if(!(aURI instanceof Ci.nsIURI)){cspError(aCSPRep,CSPLocalizer.getStr("cspSourceNotURI"));return null;}
if(!self&&enforceSelfChecks){cspError(aCSPRep,CSPLocalizer.getStr("selfDataNotProvided"));return null;}
if(self&&!(self instanceof CSPSource)){self=CSPSource.create(self,aCSPRep,undefined,false);}
var sObj=new CSPSource();sObj._self=self;sObj._CSPRep=aCSPRep;
try{sObj._scheme=aURI.scheme;}catch(e){sObj._scheme=undefined;cspError(aCSPRep,CSPLocalizer.getFormatStr("uriWithoutScheme",[aURI.asciiSpec]));return null;}
try{
sObj._host=CSPHost.fromString(aURI.host);}catch(e){sObj._host=undefined;}




sObj._port=undefined;try{
if(aURI.port>0){sObj._port=aURI.port;}}catch(e){sObj._port=undefined;}
return sObj;};CSPSource.fromString=function(aStr,aCSPRep,self,enforceSelfChecks){if(!aStr)
return null;if(!(typeof aStr==='string')){cspError(aCSPRep,CSPLocalizer.getStr("argumentIsNotString"));return null;}
var sObj=new CSPSource();sObj._self=self;sObj._CSPRep=aCSPRep; if(aStr==="*"){sObj._permitAll=true;return sObj;}
if(!self&&enforceSelfChecks){cspError(aCSPRep,CSPLocalizer.getStr("selfDataNotProvided"));return null;}
if(self&&!(self instanceof CSPSource)){self=CSPSource.create(self,aCSPRep,undefined,false);}
if(aStr.toLowerCase()==="'unsafe-inline'"){sObj._allowUnsafeInline=true;return sObj;}
if(aStr.toLowerCase()==="'unsafe-eval'"){sObj._allowUnsafeEval=true;return sObj;}

if(R_SCHEMESRC.test(aStr)){var schemeSrcMatch=R_GETSCHEME.exec(aStr);sObj._scheme=schemeSrcMatch[0];if(!sObj._host)sObj._host=CSPHost.fromString("*");if(!sObj._port)sObj._port="*";return sObj;} 
if(R_HOSTSRC.test(aStr)||R_EXTHOSTSRC.test(aStr)){var schemeMatch=R_GETSCHEME.exec(aStr);
 if(!schemeMatch||aStr.indexOf("://")==-1){sObj._scheme=self.scheme;schemeMatch=null;}else{sObj._scheme=schemeMatch[0];}

if(R_EXTHOSTSRC.test(aStr)){var extHostMatch=R_EXTHOSTSRC.exec(aStr);aStr=extHostMatch[1];}
var hostMatch=R_HOSTSRC.exec(aStr);if(!hostMatch){cspError(aCSPRep,CSPLocalizer.getFormatStr("couldntParseInvalidSource",[aStr]));return null;}
if(schemeMatch){hostMatch=R_HOSTSRC.exec(aStr.substring(schemeMatch[0].length+3));}
var portMatch=R_PORT.exec(hostMatch);if(portMatch){hostMatch=R_HOSTSRC.exec(hostMatch[0].substring(0,hostMatch[0].length-portMatch[0].length));}
sObj._host=CSPHost.fromString(hostMatch[0]);if(!portMatch){ var defPort=Services.io.getProtocolHandler(sObj._scheme).defaultPort;if(!defPort){cspError(aCSPRep,CSPLocalizer.getFormatStr("couldntParseInvalidSource",[aStr]));return null;}
sObj._port=defPort;}
else{ sObj._port=portMatch[0].substr(1);}
if(R_QUOTELESS_KEYWORDS.test(aStr)){cspWarn(aCSPRep,CSPLocalizer.getFormatStr("hostNameMightBeKeyword",[aStr,aStr.toLowerCase()]));}
return sObj;} 
if(R_NONCESRC.test(aStr)){return CSPNonceSource.fromString(aStr,aCSPRep);} 
if(R_HASHSRC.test(aStr)){return CSPHashSource.fromString(aStr,aCSPRep);}
if(aStr.toLowerCase()==="'self'"){if(!self){cspError(aCSPRep,CSPLocalizer.getStr("selfKeywordNoSelfData"));return null;}
sObj._self=self.clone();sObj._isSelf=true;return sObj;}
cspError(aCSPRep,CSPLocalizer.getFormatStr("couldntParseInvalidSource",[aStr]));return null;};CSPSource.validSchemeName=function(aStr){return aStr.match(/^[a-zA-Z][a-zA-Z0-9+.-]*$/);};CSPSource.prototype={get scheme(){if(this._isSelf&&this._self)
return this._self.scheme;if(!this._scheme&&this._self)
return this._self.scheme;return this._scheme;},get host(){if(this._isSelf&&this._self)
return this._self.host;if(!this._host&&this._self)
return this._self.host;return this._host;},get permitAll(){if(this._isSelf&&this._self)
return this._self.permitAll;return this._permitAll;},get port(){if(this._isSelf&&this._self)
return this._self.port;if(this._port)return this._port;
if(this.scheme){try{var port=gIoService.getProtocolHandler(this.scheme).defaultPort;if(port>0)return port;}catch(e){}}
return undefined;},toString:function(){if(this._isSelf)
return this._self.toString();if(this._allowUnsafeInline)
return"'unsafe-inline'";if(this._allowUnsafeEval)
return"'unsafe-eval'";var s="";if(this.scheme)
s=s+this.scheme+"://";if(this._host)
s=s+this._host;if(this.port)
s=s+":"+this.port;return s;},clone:function(){var aClone=new CSPSource();aClone._self=this._self?this._self.clone():undefined;aClone._scheme=this._scheme;aClone._port=this._port;aClone._host=this._host?this._host.clone():undefined;aClone._isSelf=this._isSelf;aClone._CSPRep=this._CSPRep;return aClone;},permits:function(aSource){if(!aSource)return false;if(!(aSource instanceof CSPSource))
aSource=CSPSource.create(aSource,this._CSPRep); if(this.scheme.toLowerCase()!=aSource.scheme.toLowerCase())
return false;

 if(this.port&&this.port!=="*"&&this.port!=aSource.port)
return false;

if(this.host&&!this.host.permits(aSource.host))
return false;return true;},equals:function(that,resolveSelf){

if(resolveSelf)
return this.scheme.toLowerCase()===that.scheme.toLowerCase()&&this.port===that.port&&(!(this.host||that.host)||(this.host&&this.host.equals(that.host)));return this._scheme.toLowerCase()===that._scheme.toLowerCase()&&this._port===that._port&&(!(this._host||that._host)||(this._host&&this._host.equals(that._host)));},};this.CSPHost=function CSPHost(){this._segments=[];}
CSPHost.fromString=function(aStr){if(!aStr)return null;var invalidChar=aStr.match(R_INV_HCHAR);if(invalidChar){CSPdebug("Invalid character '"+invalidChar+"' in host "+aStr);return null;}
var hObj=new CSPHost();hObj._segments=aStr.split(/\./);if(hObj._segments.length<1)
return null; for(var i in hObj._segments){var seg=hObj._segments[i];if(seg=="*"){if(i>0){ CSPdebug("Wildcard char located at invalid position in '"+aStr+"'");return null;}}
else if(seg.match(R_COMP_HCHAR)){ CSPdebug("Invalid segment '"+seg+"' in host value");return null;}}
return hObj;};CSPHost.prototype={toString:function(){return this._segments.join(".");},clone:function(){var aHost=new CSPHost();for(var i in this._segments){aHost._segments[i]=this._segments[i];}
return aHost;},permits:function(aHost){if(!aHost){aHost=CSPHost.fromString("*");}
if(!(aHost instanceof CSPHost)){ aHost=CSPHost.fromString(aHost);}
var thislen=this._segments.length;var thatlen=aHost._segments.length;if(thatlen<thislen){return false;}
if((thatlen>thislen)&&this._segments[0]!="*"){return false;}

for(var i=1;i<=thislen;i++){if(this._segments[thislen-i]!="*"&&(this._segments[thislen-i].toLowerCase()!=aHost._segments[thatlen-i].toLowerCase())){return false;}} 
return true;},equals:function(that){if(this._segments.length!=that._segments.length)
return false;for(var i=0;i<this._segments.length;i++){if(this._segments[i].toLowerCase()!=that._segments[i].toLowerCase()){return false;}}
return true;}};this.CSPNonceSource=function CSPNonceSource(){this._nonce=undefined;}
CSPNonceSource.fromString=function(aStr,aCSPRep){let nonce=R_NONCESRC.exec(aStr)[1];if(!nonce){cspError(aCSPRep,"Error in parsing nonce-source from string: nonce was empty");return null;}
let nonceSourceObj=new CSPNonceSource();nonceSourceObj._nonce=nonce;return nonceSourceObj;};CSPNonceSource.prototype={permits:function(aContext){if(aContext instanceof Ci.nsIDOMHTMLElement){return this._nonce===aContext.getAttribute('nonce');}else if(typeof aContext==='string'){return this._nonce===aContext;}
CSPdebug("permits called on nonce-source, but aContext was not nsIDOMHTMLElement or string (was "+typeof(aContext)+")");return false;},toString:function(){return"'nonce-"+this._nonce+"'";},clone:function(){let clone=new CSPNonceSource();clone._nonce=this._nonce;return clone;},equals:function(that){return this._nonce===that._nonce;}};this.CSPHashSource=function CSPHashSource(){this._algo=undefined;this._hash=undefined;}
CSPHashSource.fromString=function(aStr,aCSPRep){let hashSrcMatch=R_HASHSRC.exec(aStr);let algo=hashSrcMatch[1];let hash=hashSrcMatch[2];if(!algo){cspError(aCSPRep,"Error parsing hash-source from string: algo was empty");return null;}
if(!hash){cspError(aCSPRep,"Error parsing hash-source from string: hash was empty");return null;}
let hashSourceObj=new CSPHashSource();hashSourceObj._algo=algo;hashSourceObj._hash=hash;return hashSourceObj;};CSPHashSource.prototype={permits:function(aContext){let ScriptableUnicodeConverter=Components.Constructor("@mozilla.org/intl/scriptableunicodeconverter","nsIScriptableUnicodeConverter");let converter=new ScriptableUnicodeConverter();converter.charset='utf8';let utf8InnerHTML=converter.convertToByteArray(aContext);let CryptoHash=Components.Constructor("@mozilla.org/security/hash;1","nsICryptoHash","initWithString");let hash=new CryptoHash(this._algo);hash.update(utf8InnerHTML,utf8InnerHTML.length); let contentHash=hash.finish(true);

 contentHash=contentHash.replace('\r\n','');return contentHash===this._hash;},toString:function(){return"'"+this._algo+'-'+this._hash+"'";},clone:function(){let clone=new CSPHashSource();clone._algo=this._algo;clone._hash=this._hash;return clone;},equals:function(that){return this._algo===that._algo&&this._hash===that._hash;}};this.CSPViolationReportListener=function CSPViolationReportListener(reportURI){this._reportURI=reportURI;}
CSPViolationReportListener.prototype={_reportURI:null,QueryInterface:function(iid){if(iid.equals(Ci.nsIStreamListener)||iid.equals(Ci.nsIRequestObserver)||iid.equals(Ci.nsISupports))
return this;throw Components.results.NS_ERROR_NO_INTERFACE;},onStopRequest:function(request,context,status){if(!Components.isSuccessCode(status)){CSPdebug("error "+status.toString(16)+" while sending violation report to "+
this._reportURI);}},onStartRequest:function(request,context){},onDataAvailable:function(request,context,inputStream,offset,count){var input=Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Ci.nsIScriptableInputStream);input.init(inputStream);input.read(count);},};function innerWindowFromRequest(docRequest){let win=null;let loadContext=null;try{loadContext=docRequest.notificationCallbacks.getInterface(Ci.nsILoadContext);}catch(ex){try{loadContext=docRequest.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);}catch(ex){return null;}}
if(loadContext){win=loadContext.associatedWindow;}
if(win){try{let winUtils=win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);return winUtils.currentInnerWindowID;}catch(ex){return null;}}
return null;}
function cspError(aCSPRep,aMessage){if(aCSPRep){aCSPRep.log(ERROR_FLAG,aMessage);}else{(new CSPRep()).log(ERROR_FLAG,aMessage);}}
function cspWarn(aCSPRep,aMessage){if(aCSPRep){aCSPRep.log(WARN_FLAG,aMessage);}else{(new CSPRep()).log(WARN_FLAG,aMessage);}}
this.CSPLocalizer={getStr:function CSPLoc_getStr(aName)
{let result;try{result=this.stringBundle.GetStringFromName(aName);}
catch(ex){Cu.reportError("Failed to get string: "+aName);throw ex;}
return result;},getFormatStr:function CSPLoc_getFormatStr(aName,aArray)
{let result;try{result=this.stringBundle.formatStringFromName(aName,aArray,aArray.length);}
catch(ex){Cu.reportError("Failed to format string: "+aName);throw ex;}
return result;},};XPCOMUtils.defineLazyGetter(CSPLocalizer,"stringBundle",function(){return Services.strings.createBundle(STRINGS_URI);});