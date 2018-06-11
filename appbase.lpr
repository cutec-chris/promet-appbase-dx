program appbase;
  uses js, web, classes, sysutils, webrouter, Avamm, dhtmlx_base, dhtmlx_form,
    dhtmlx_treeview, dhtmlx_layout, dhtmlx_sidebar, promet_dhtmlx, AvammDB,
    dhtmlx_db;

var
  LoadEnviroment : Boolean = True;
  Treeview: TDHTMLXTreeview;
  Layout: TDHTMLXLayout;
  InitRouteFound: Boolean;


resourcestring
  strMenu                   = 'Menü';
  strStartpage              = 'Startseite';
  strReconnecting           = 'Verbindung zum Server fehlgeschlagen,'+#10#13+'Verbindung wird automatisch wiederhergestellt';

procedure LoadStartpage(URl : String; aRoute : TRoute; Params: TStrings);
begin
  writeln('Startpage should be shown ...');
end;
procedure RouterBeforeRequest(Sender: TObject; var ARouteURL: String);
begin
  Layout.progressOn;
end;
procedure RouterAfterRequest(Sender: TObject; const ARouteURL: String);
begin
  Layout.progressOff;
end;
procedure AddToSidebar(Name: string; Route: TRoute);
begin
  TreeView.addItem(Name,Name);
  Treeview.setUserData(Name,'route',Route);
end;
procedure TreeviewItemSelected(aItem : JSValue);
var
  aData: TRoute;
begin
  aData := TRoute(Treeview.getUserData(aItem,'route'));
  Router.Push(aData.URLPattern);
end;
function FillEnviroment(aValue : JSValue) : JSValue;
var
  i: Integer;
  aCell: TDHTMLXLayoutCell;
  tmp, aId: String;
  function FillEnviromentAfterLogin(aValue: JSValue): JSValue;
    procedure ModuleLoaded(aObj : JSValue);
    begin
      asm
        console.log(aObj);
        rtl.run(aObj.originalTarget.id.split("/")[0]);
      end;
      if not InitRouteFound then
        if THashHistory(Router.History).getHash<>'' then
          if Router.FindHTTPRoute(THashHistory(Router.History).getHash,nil) <> nil then
            InitRouteFound := Router.Push(THashHistory(Router.History).getHash) = trOK;
    end;
  var
    aRights: TJSArray;
    aRight: String;
  begin
    if Router.FindHTTPRoute('startpage',nil) <> nil then exit;
    writeln('FillEnviromentAfterLogin');
    RegisterSidebarRoute(strStartpage,'startpage',@LoadStartpage);
    aRights := TJSArray(UserOptions.Properties['rights']);
    for i := 0 to aRights.Length-1 do
      begin
        aRight := string(TJSObject.getOwnPropertyNames(TJSObject(aRights[i]))[0]);
        try
          if Integer(TJSObject(aRights[i]).Properties[aRight])>1 then
            AppendJS(lowercase(aRight)+'/'+lowercase(aRight)+'.js',@ModuleLoaded,null);
        except
        end;
      end;
    if window.document.body.clientWidth > 700 then
      Layout.cells('a').expand;
  end;
  function LoginFailed(aValueE: JSValue): JSValue;
    function DoShowError(aValue: JSValue): JSValue;
    begin
      if not (aValue is TJSError) then
        dhtmlx.message(js.new(['type','error',
                               'text',strLoginFailed]))
      else
        dhtmlx.message(js.new(['type','error',
                               'text',aValue]));
      CheckLogin;
    end;
  begin
    WidgetsetLoaded._then(@DoShowError);
  end;
  function TryReconnect(aValueE: JSValue): JSValue;
  const
    Timeout = 5000;
    function ShowError(aValue: JSValue): JSValue;
    begin
      dhtmlx.message(js.new(['type','error',
                             'text',strReconnecting,
                             'expire', Timeout]));
    end;
    function Reconnect(aValue: JSValue): JSValue;
      function DoCheckLogin(aValue: JSValue): JSValue;
      begin
        CheckLogin;
      end;
    begin
      Wait(Timeout-50)._then(@DoCheckLogin);
    end;
  begin
    WidgetsetLoaded._then(@ShowError)
                   ._then(@Reconnect);
  end;
begin
  Avamm.OnAddToSidebar:=@AddToSidebar;
  Layout := TDHTMLXLayout.New(js.new(['parent',window.document.body,'pattern','2U']));
  Layout.cells('a').setWidth(200);
  Layout.cells('a').setText(strMenu);
  Layout.cells('a').setCollapsedText(strMenu);
  Layout.cells('a').collapse;
  Layout.cells('b').hideHeader;
  Treeview := TDHTMLXTreeview(Layout.cells('a').attachTreeView());
  Treeview.attachEvent('onSelect',@TreeviewItemSelected);
  window.addEventListener('AfterLogin',@FillEnviromentAfterLogin);
  window.addEventListener('AfterLogout',@LoginFailed);
  window.addEventListener('ConnectionError',@TryReconnect);
  CheckLogin;
  Router.BeforeRequest:=@RouterBeforeRequest;
  Router.AfterRequest:=@RouterAfterRequest;
end;
begin
  if LoadEnviroment then
    WidgetsetLoaded._then(@FillEnviroment);
  if THashHistory(Router.History).getHash<>'' then
    if Router.FindHTTPRoute(THashHistory(Router.History).getHash,nil) <> nil then
      InitRouteFound := Router.Push(THashHistory(Router.History).getHash) = trOK;
end.
