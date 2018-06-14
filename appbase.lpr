program appbase;
  uses js, web, classes, sysutils, webrouter, dhtmlx_form,Avamm, promet_dhtmlx,
    dhtmlx_treeview, dhtmlx_layout, dhtmlx_sidebar, dhtmlx_base,AvammForms;

var
  LoadEnviroment : Boolean = True;
  Treeview: TDHTMLXTreeview;
  Layout: TDHTMLXLayout;
  InitRouteFound: Boolean;
  TreeviewSelectionChanged : JSValue;
  FContainer : TJSHTMLElement;

resourcestring
  strMenu                   = 'Menü';
  strStartpage              = 'Startseite';
  strReconnecting           = 'Verbindung zum Server fehlgeschlagen,'+#10#13+'Verbindung wird automatisch wiederhergestellt';

procedure LoadStartpage(URl : String; aRoute : TRoute; Params: TStrings);
  procedure HideElement(currentValue: TJSNode;
    currentIndex: NativeInt; list: TJSNodeList);
  begin
    TJSHTMLElement(currentValue).style.setProperty('display','none');
  end;
begin
  writeln('Startpage should be shown ...');
  FContainer.childNodes.forEach(@HideElement);
end;
procedure RouterBeforeRequest(Sender: TObject; var ARouteURL: String);
begin
  Layout.progressOn;
end;
procedure RouterAfterRequest(Sender: TObject; const ARouteURL: String);
var
  aRoute: TRoute;
begin
  Layout.progressOff;
end;
procedure AddToSidebar(Name: string; Route: TRoute);
begin
  TreeView.addItem(Route.ID,Name);
  Treeview.setUserData(Route.ID,'route',Route);
end;
procedure TreeviewItemSelected(aItem : JSValue);
var
  aData: TRoute;
begin
  aData := TRoute(Treeview.getUserData(aItem,'route'));
  if THashHistory(Router.History).getHash<>aData.URLPattern then
    Router.Push(aData.URLPattern);
end;
procedure OnReady(Sender: THistory; aLocation: String; aRoute: TRoute);
begin
  Treeview.selectItem(aRoute.ID);
end;
procedure DoHandleException(aName: JSValue);
  function ShowError(aValue: JSValue): JSValue;
  begin
    dhtmlx.message(js.new(['type','error',
                           'text',aName]));
  end;
begin
  writeln('Unhandled Exception:',aName);
  WidgetsetLoaded._then(@ShowError);
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
        rtl.run(aObj.target.id.split("/")[0]);
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
      Avamm.deleteCookie('login');
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
  Avamm.OnException:=@DoHandleException;
  Avamm.OnAddToSidebar:=@AddToSidebar;
  Layout := TDHTMLXLayout.New(js.new(['parent',window.document.body,'pattern','2U']));
  Layout.cells('a').setWidth(200);
  Layout.cells('a').setText(strMenu);
  Layout.cells('a').setCollapsedText(strMenu);
  Layout.cells('a').collapse;
  Layout.cells('b').hideHeader;
  Layout.setSeparatorSize(0,5);
  Layout.setSeparatorSize(1,5);
  Layout.setOffsets(js.new(['left',3,'top',3,'right',3,'bottom',3]));
  Treeview := TDHTMLXTreeview(Layout.cells('a').attachTreeView());
  TreeviewSelectionChanged := Treeview.attachEvent('onClick',@TreeviewItemSelected);
  window.addEventListener('AfterLogin',@FillEnviromentAfterLogin);
  window.addEventListener('AfterLogout',@LoginFailed);
  window.addEventListener('ConnectionError',@TryReconnect);
  CheckLogin;
  Router.BeforeRequest:=@RouterBeforeRequest;
  Router.AfterRequest:=@RouterAfterRequest;
  Router.History.OnReady:=@Onready;
end;
function DoGetAvammContainer: JSValue;
  procedure ResizePanelsLater;
  begin
    asm
      window.dispatchEvent(pas.Avamm.ContainerResizedEvent);
    end;
  end;
  procedure DoResizePanels;
  begin
    window.setTimeout(@ResizePanelsLater,10);
  end;
begin
  if FContainer = nil then
    begin
      FContainer := TJSHTMLElement(document.createElement('div'));
      FContainer.style.setProperty('height','100%');
      FContainer.style.setProperty('width','100%');
      Layout.cells('b').appendObject(FContainer);
    end;
  Result := FContainer;
  Layout.attachEvent('onResizeFinish',@DoResizePanels);
end;
begin
  GetAvammContainer := @DoGetAvammContainer;
  if LoadEnviroment then
    WidgetsetLoaded._then(@FillEnviroment);
  if THashHistory(Router.History).getHash<>'' then
    if Router.FindHTTPRoute(THashHistory(Router.History).getHash,nil) <> nil then
      InitRouteFound := Router.Push(THashHistory(Router.History).getHash) = trOK;
end.
