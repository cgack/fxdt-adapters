'use strict';const{Class}=require('../core/heritage');const{windowNS}=require('./namespace');const{on,off,once}=require('../event/core');const{method}=require('../lang/functional');const{getWindowTitle}=require('./utils');const unload=require('../system/unload');const{isWindowPrivate}=require('../window/utils');const{EventTarget}=require('../event/target');const{getOwnerWindow:getPBOwnerWindow}=require('../private-browsing/window/utils');const{viewFor}=require('../view/core');const{deprecateUsage}=require('../util/deprecate');const ERR_FENNEC_MSG='This method is not yet supported by Fennec, consider using require("sdk/tabs") instead';const BrowserWindow=Class({initialize:function initialize(options){EventTarget.prototype.initialize.call(this,options);windowNS(this).window=options.window;},activate:function activate(){ return null;},close:function(){throw new Error(ERR_FENNEC_MSG);return null;},get title()getWindowTitle(windowNS(this).window),

 get tabs()require('../tabs'),get activeTab()require('../tabs').activeTab,on:method(on),removeListener:method(off),once:method(once),get isPrivateBrowsing(){deprecateUsage('`browserWindow.isPrivateBrowsing` is deprecated, please '+'consider using '+'`require("sdk/private-browsing").isPrivate(browserWindow)` '+'instead.');return isWindowPrivate(windowNS(this).window);}});exports.BrowserWindow=BrowserWindow;const getWindowView=window=>windowNS(window).window;getPBOwnerWindow.define(BrowserWindow,getWindowView);viewFor.define(BrowserWindow,getWindowView);