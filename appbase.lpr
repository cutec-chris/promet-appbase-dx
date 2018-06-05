program appbase;
  uses js,web,webrouter,classes,sysutils,
    dhtmlx_form, dhtmlx_base;

procedure ShowStartPage(URl : String; aRoute : TRoute; Params: TStrings);
begin
  writeln('Showing Startpage');
end;

var
  aLoc: String;
begin
  writeln('Appbase initializing...');
  Router.InitHistory(hkHash);
  Router.RegisterRoute('startpage',@ShowStartPage,True);
  aLoc := THashHistory(Router.History).getHash;
  if aLoc = '' then
    begin
      //no Enviroment loaded, load Sidebar
      Router.Push('startpage')
    end
  else
    begin
      //Sub URL Routing, no Enviroment needed
      writeln('Routing to "'+aLoc+'"');
      Router.Push(aLoc);
    end;
end.
