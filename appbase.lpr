program appbase;
  uses js,web,classes,sysutils,webrouter,
    promet_base, dhtmlx_base, dhtmlx_form, dhtmlx_sidebar;

var
  aLoc: String;
  Sidebar: TSidebar;

begin
  aLoc := THashHistory(Router.History).getHash;
  if aLoc = '' then
    begin
      //no Enviroment loaded, load Sidebar
      writeln('creating Sidebar');
      Sidebar := TSidebar.Create(window.document.body);
      Router.Push('startpage')
    end
  else
    begin
      //Sub URL Routing, no Enviroment needed
      writeln('Routing to "'+aLoc+'"');
      Router.Push(aLoc);
    end;
end.
