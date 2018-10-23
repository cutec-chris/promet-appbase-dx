program appbase;
  uses js, web, classes, sysutils, AvammRouter,webrouter, dhtmlx_form, Avamm, promet_dhtmlx,
    dhtmlx_treeview, dhtmlx_layout, dhtmlx_sidebar, dhtmlx_base, AvammForms, dhtmlx_windows,
    dhtmlx_calendar,dhtmlx_carousel,dhtmlx_dataview,avammcalendar,
    AvammAutocomplete;

const
  MobileCellWidth = 700;

var
  LoadEnviroment : Boolean = True;
  Treeview: TDHTMLXTreeview;
  Layout: TDHTMLXLayout;
  InitRouteFound: Boolean;
  TreeviewSelectionChanged : JSValue;
  FContainer : TJSHTMLElement;
  FInitialized : Boolean;

resourcestring
  strMenu                   = 'Menü';
  strStartpage              = 'Startseite';
  strReconnecting           = 'Verbindung zum Server fehlgeschlagen,'+#10#13+'Verbindung wird automatisch wiederhergestellt';
  strApplicationLoading     = 'Verbindung wird hergestellt...';
  strRequestTimeout         = 'Es ist eine Zeitüberschreitung beim Abrufen von Daten aufgetreten !';

procedure RouterBeforeRequest(Sender: TObject; var ARouteURL: String);
begin
  Layout.progressOn;
end;
procedure RouterAfterRequest(Sender: TObject; const ARouteURL: String);
begin
  Layout.progressOff;
end;
procedure AddToSidebar(Name: string; Route: TRoute;Icon : string);
begin
  TreeView.addItem(Route.ID,Name);
  Treeview.setUserData(Route.ID,'route',Route);
  Treeview.setItemIcons(Route.ID,js.new(['file',Icon,
                                'folder-opened',Icon,
                                'folder-closed',Icon]));
end;
procedure TreeviewItemSelected(aItem : JSValue);
var
  aData: TRoute;
begin
  aData := TRoute(Treeview.getUserData(aItem,'route'));
  if THashHistory(Router.History).getHash<>aData.URLPattern then
    Router.Push(aData.URLPattern);
  if window.document.body.clientWidth<=MobileCellWidth then
    Layout.cells('a').collapse;
end;
procedure OnReady(Sender: THistory; aLocation: String; aRoute: TRoute);
  procedure DoCloseWindow(aWindow : TDHTMLXWindowsCell);
  begin
    //TODO:close only windows that are not the actual route (more Windows open)
    aWindow.close;
  end;

begin
  try
    if pos('/by-id/',aLocation)=0 then
      begin
        Treeview.selectItem(aRoute.ID);
        Windows.forEachWindow(@DoCloseWindow);
      end;
  except
  end;
end;
procedure DoHandleException(aName: JSValue);
  function ShowError(aValue: JSValue): JSValue;
  begin
    asm
      if (aName.error) aName = aName.error;
      if (aName.reason) aName = aName.reason;
      if ((aName.fMessage)) aName = aName.fMessage;
    end;
    if aName is TJSXMLHttpRequest then
      begin
        if TJSXMLHttpRequest(aName).Status <> 4 then
          aName := strRequestTimeout;
      end;
    dhtmlx.message(js.new(['type','error',
                           'text',aName]));
  end;
begin
  WidgetsetLoaded._then(@ShowError);
end;

function FillEnviroment(aValue : JSValue) : JSValue;
var
  i: Integer;
  aCell: TDHTMLXLayoutCell;
  tmp, aId: String;
  MainDiv, aDiv: TJSElement;
  FindRouteLast: NativeInt;
  procedure SetStatusHintText(text : string);
  begin
    document.getElementById('lStatusHint').innerHTML:=text;
  end;
  function RemoveStatusTextText(aValue: JSValue): JSValue;
  begin
    TJSHTMLElement(aDiv).style.setProperty('display','none');
  end;
  function FillEnviromentAfterLogin(aValue: JSValue): JSValue;
    procedure FindInitRoute;
    begin
      if not InitRouteFound then
        if THashHistory(Router.History).getHash<>'' then
          if Router.FindHTTPRoute(THashHistory(Router.History).getHash,nil) <> nil then
            InitRouteFound := Router.Push(THashHistory(Router.History).getHash) = trOK;
    end;
    procedure ModuleLoaded(aObj : JSValue);
    begin
      if not InitRouteFound then
        if THashHistory(Router.History).getHash<>'' then
          if Router.FindHTTPRoute(THashHistory(Router.History).getHash,nil) <> nil then
            InitRouteFound := Router.Push(THashHistory(Router.History).getHash) = trOK;
      window.clearTimeout(FindRouteLast);
      if not InitRouteFound then
        FindRouteLast := window.setTimeout(@FindInitRoute,100);
    end;
  var
    aRights: TJSArray;
    aRight: String;
  begin
    if FInitialized then exit;
    FInitialized := True;
    aRights := TJSArray(UserOptions.Properties['rights']);
    for i := 0 to aRights.Length-1 do
      begin
        aRight := string(TJSObject.getOwnPropertyNames(TJSObject(aRights[i]))[0]);
        try
          if Integer(TJSObject(aRights[i]).Properties[aRight])>=0 then
            LoadModule(lowercase(aRight),@ModuleLoaded);
        except
        end;
      end;
    FindRouteLast := window.setTimeout(@FindInitRoute,100);
    if window.document.body.clientWidth > MobileCellWidth then
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
    function Reconnect(aValue: JSValue): JSValue;
      function DoCheckLogin(aValue: JSValue): JSValue;
      begin
        CheckLogin;
      end;
    begin
      SetStatusHintText(strReconnecting);
      Wait(Timeout-50)._then(@DoCheckLogin);
    end;
  begin
    WidgetsetLoaded._then(@Reconnect);
  end;
  procedure AddLoadingHint;
  var
    aSide: TJSNode;
    aSides: TJSHTMLCollection;
  begin
    try
      aSides := document.getElementsByClassName('dhx_cell_cont_layout');
      aSide := aSides.Items[1];
      if Assigned(aSide) then
        begin
          aDiv := document.createElement('div');
          aDiv.id:='pStatusHint';
          aSide.appendChild(aDiv);
          aDiv.innerHTML:='<font face="verdana"><p id="lStatusHint" align="center"></p></font>';
        end;
      SetStatusHintText(strApplicationLoading);
    except
    end;
  end;
begin
  Avamm.OnException:=@DoHandleException;
  Avamm.OnAddToSidebar:=@AddToSidebar;
  MainDiv := document.getElementById('AvammMainDiv');
  if not Assigned(MainDiv) then
    MainDiv := window.document.body;
  Layout := TDHTMLXLayout.New(js.new(['parent',MainDiv,'pattern','2U']));
  Layout.cells('a').setWidth(200);
  Layout.cells('a').setText(strMenu);
  Layout.cells('a').setCollapsedText(strMenu);
  Layout.cells('a').collapse;
  Layout.cells('b').hideHeader;
  try
    //remove content Cell borders
    TJSHTMLElement(Layout.cells('b').cell.childNodes[1]).style.setProperty('border-width','0px');
    TJSHTMLElement(Layout.cells('b').cell.childNodes[0]).style.setProperty('border-width','0px');
  except
  end;
  Layout.setSeparatorSize(0,5);
  Layout.setSeparatorSize(1,5);
  Layout.cont.style.setProperty('border-width','0');
  Layout.setOffsets(js.new(['left',3,'top',3,'right',3,'bottom',3]));
  Treeview := TDHTMLXTreeview(Layout.cells('a').attachTreeView());
  Treeview.setIconset('font_awesome');
  TreeviewSelectionChanged := Treeview.attachEvent('onClick',@TreeviewItemSelected);
  window.addEventListener('BeforeLogin',@RemoveStatusTextText);
  window.addEventListener('AfterLogin',@FillEnviromentAfterLogin);
  window.addEventListener('AfterLogout',@LoginFailed);
  window.addEventListener('ConnectionError',@TryReconnect);
  CheckLogin._then(@RemoveStatusTextText);
  Router.BeforeRequest:=@RouterBeforeRequest;
  Router.AfterRequest:=@RouterAfterRequest;
  Router.History.OnReady:=@Onready;
  AddLoadingHint;
  asm //remove Adressbar on mobile devices if possible
  if (window.navigator.standalone == false) {
      window.scrollTo(0, 1);
  }
  end;
end;
function DoGetAvammContainer: JSValue;
var
  aResizer: NativeInt;
  procedure ResizePanelsLater;
    procedure HandlwWindowresize(wn : TDHTMLXWindowsCell);
    begin
      if wn.isMaximized then
        begin
          wn.minimize;
          wn.maximize;
        end;
    end;

  begin
    asm
      window.dispatchEvent(pas.Avamm.ContainerResizedEvent);
    end;
    Windows.forEachWindow(@HandlwWindowresize);
  end;
  procedure DoResizePanels;
  begin
    window.clearTimeout(aResizer);
    aResizer := window.setTimeout(@ResizePanelsLater,100);
  end;
begin
  if FContainer = nil then
    begin
      FContainer := TJSHTMLElement(document.createElement('div'));
      FContainer.style.setProperty('height','100%');
      FContainer.style.setProperty('width','100%');
      Layout.cells('b').appendObject(FContainer);
      Layout.attachEvent('onResizeFinish',@DoResizePanels);
      Layout.attachEvent('onCollapse',@DoResizePanels);
      Layout.attachEvent('onExpand',@DoResizePanels);
      Layout.attachEvent('onPanelResizeFinish',@DoResizePanels);
      window.addEventListener('ContainerResized',@DoResizePanels);
    end;
  Result := FContainer;
end;
procedure HideAdressBar;
begin
  window.scrollTo(0,1);
end;
begin
  FInitialized := False;
  GetAvammContainer := @DoGetAvammContainer;
  window.setTimeout(@HideAdressBar,0);
  dhtmlx_base.AppendCSS('index.css',null,null);
  if LoadEnviroment then
    WidgetsetLoaded._then(@FillEnviroment);
  if THashHistory(Router.History).getHash<>'' then
    begin
      if Router.FindHTTPRoute(THashHistory(Router.History).getHash,nil) <> nil then
        InitRouteFound := Router.Push(THashHistory(Router.History).getHash) = trOK;
    end;
end.
