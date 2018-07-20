library startpage;
  uses js, web, classes, Avamm, webrouter, AvammForms, dhtmlx_base,
    dhtmlx_form,SysUtils, Types, AvammWiki;

type

resourcestring
  strStartpage              = 'Startseite';

Procedure DoShowStartpage(URl : String; aRoute : TRoute; Params: TStrings);
begin
  AvammWiki.ShowStartpage;
end;

function LoadStartpage(aValue : JSValue) : JSValue;
begin
  if Router.FindHTTPRoute('startpage',nil) <> nil then exit;
  RegisterSidebarRoute(strStartpage,'startpage',@DoShowStartpage,'fa-columns');
  if THashHistory(Router.History).getHash='' then
    Router.Push('startpage');
end;

initialization
  WidgetsetLoaded._then(@LoadStartPage);
end.

