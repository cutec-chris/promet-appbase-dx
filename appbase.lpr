program appbase;
  uses browserconsole,browserapp,webrouter,classes;

procedure ShowStartPage(URl : String; aRoute : TRoute; Params: TStrings);
begin
end;

begin
  writeln('Appbase initializing...');
  Router.InitHistory(hkHash);
  Router.RegisterRoute('startpage',@ShowStartPage,True);
  Router.Push('startpage');
end.
