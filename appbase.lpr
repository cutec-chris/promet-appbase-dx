program appbase;
  uses js,web,classes,sysutils,webrouter,
    promet_base, dhtmlx_base, dhtmlx_form, dhtmlx_treeview, dhtmlx_layout, dhtmlx_sidebar;

var
  LoadEnviroment : Boolean = True;
  Treeview: TTreeview;
  Layout: TLayout;


function FillEnviroment(aValue : JSValue) : JSValue;
var
  i: Integer;
begin
  Layout := TLayout.Create(window.document.body,'2U');
  Treeview := TTreeview.Create(Layout.cells['a']);
  //Treeview.AfterCreate._then(@FillEnviroment);
  for i := 0 to Router.RouteCount-1 do
    begin
    end;
end;
begin
  //Router.RegisterRoute('startpage',@ShowStartpage,True);
  if LoadEnviroment then
    begin
      DHTMLXPromise._then(@FillEnviroment);
    end;
  if THashHistory(Router.History).getHash<>'' then
    Router.Push(THashHistory(Router.History).getHash);
end.
