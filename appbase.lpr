program appbase;
  uses js,web,classes,sysutils,webrouter,
    promet_base, dhtmlx_base, dhtmlx_form, dhtmlx_sidebar;

var
  aLoc: String;
  Sidebar: TSidebar;

Function LoadContents(aValue : JSValue) : JSValue;
begin
  writeln('creating Sidebar');
  Sidebar := TSidebar.New(null);
  Router.Push('startpage')
end;

begin
  aLoc := THashHistory(Router.History).getHash;
  if aLoc = '' then
    begin
      //no Enviroment loaded, load Sidebar
      DHTMLXPromise._then(@LoadContents);
    end
  else
    begin
      //Sub URL Routing, no Enviroment needed
      writeln('Routing to "'+aLoc+'"');
      Router.Push(aLoc);
    end;
end.
