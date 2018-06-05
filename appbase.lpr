program appbase;
  uses js,web,webrouter,classes,sysutils;

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
    Router.Push('startpage')
  else
    begin
      writeln('Routiong to "'+aLoc+'"');
      Router.Push(aLoc);
    end;
end.
