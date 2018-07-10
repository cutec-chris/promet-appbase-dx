rtl.module("startpage",["System","JS","Classes","Avamm","webrouter","dhtmlx_base","SysUtils","AvammWiki"],function () {
  "use strict";
  var $mod = this;
  this.DoShowStartpage = function (URl, aRoute, Params) {
    pas.AvammWiki.ShowStartpage();
  };
  this.LoadStartpage = function (aValue) {
    var Result = undefined;
    if (pas.webrouter.Router().FindHTTPRoute("startpage",null) !== null) return Result;
    pas.Avamm.RegisterSidebarRoute(rtl.getResStr(pas.startpage,"strStartpage"),"startpage",$mod.DoShowStartpage);
    if (pas.webrouter.Router().GetHistory().$class.getHash() === "") pas.webrouter.Router().Push("startpage");
    return Result;
  };
  $mod.$resourcestrings = {strStartpage: {org: "Startseite"}};
  $mod.$init = function () {
    pas.dhtmlx_base.WidgetsetLoaded.then($mod.LoadStartpage);
  };
});
//# sourceMappingURL=startpage.js.map
