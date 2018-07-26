unit AvammForms;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, AvammDB, dhtmlx_form, dhtmlx_toolbar,dhtmlx_grid,
  dhtmlx_layout,dhtmlx_popup, dhtmlx_db,dhtmlx_base,dhtmlx_windows,dhtmlx_tabbar,
  AvammRouter,webrouter, db, Avamm;

type

  { TAvammContentForm }

  TAvammContentForm = class
  private
    FParent : TJSElement;
    FContainer : TJSHTMLElement;
  protected
    procedure DoShow;
  public
    constructor Create(aParent : TJSElement);virtual;
    procedure Show;virtual;
    property Container : TJSHTMLElement read FContainer;
    property Parent : TJSElement read FParent;
  end;

  { TAvammListForm }

  TAvammListForm = class(TAvammContentForm)
  private
    FFilterHeader: string;
    FOldFilter: String;
    FDataSource : TDataSource;
    FDataLink : TDHTMLXDataLink;
    FDataSet : TAvammDataset;
    FTableName : string;
    procedure FDataSetLoadFail(DataSet: TDataSet; ID: Integer;
      const ErrorMsg: String);
    procedure SetFilterHeader(AValue: string);
    procedure SwitchProgressOff(DataSet: TDataSet; Data: JSValue);
  protected
    function DoRowDblClick : Boolean;virtual;
    procedure ToolbarButtonClick(id : string);virtual;
  public
    Page : TDHTMLXLayout;
    Toolbar : TDHTMLXToolbar;
    Grid : TDHTMLXGrid;
    constructor Create(aParent : TJSElement;aDataSet : string;aPattern : string = '1C');virtual;
    procedure RefreshList;virtual;
    procedure Show; override;
    property FilterHeader : string read FFilterHeader write SetFilterHeader;
    property DataSet : TAvammDataset read FDataSet;
    property DataLink : TDHTMLXDataLink read FDataLink;
  end;

  TAvammFormMode = (fmTab,fmWindow,fmInlineWindow);

  { TAvammForm }

  TAvammForm = class
  private
    FID : JSValue;
    FParams: TStrings;
    FTablename: string;
    FWindow: JSValue;
    FParent: JSValue;
    FData: TJSObject;
    FRawData : TJSObject;
  protected
    Layout: TDHTMLXLayout;
    Form: TDHTMLXForm;
    gHistory: TDHTMLXGrid;
    Toolbar: TDHTMLXToolbar;
    Tabs: TDHTMLXTabbar;
    ReportsLoaded: TJSPromise;
    WikiLoaded: TJSPromise;
    procedure DoLoadData;virtual;
    procedure DoLoadHistory;
    procedure SetTitle(aTitle : string);
    function DoClose : Boolean;
    procedure Refresh;virtual;
    procedure DoSave;virtual;
  public
    BaseId : JSValue;
    Reports: TJSArray;
    constructor Create(mode : TAvammFormMode;aDataSet : string;Id : JSValue;Params : string = '');
    property Id : JSValue read FID;
    property Tablename : string read FTablename;
    property Data : TJSObject read FData;
    property Params : TStrings read FParams;
  end;

  { TAvammAutoComplete }

  TAvammAutoComplete = class
  private
    FDataSource : TDataSource;
    FDataLink : TDHTMLXDataLink;
    FDataSet : TAvammDataset;
    aTimer: NativeInt;
    FDblClick: TNotifyEvent;
    FFilter: string;
    IsLoading : Boolean;
    FSelect: Boolean;
    FPopupParams : JSValue;
    procedure FDataSourceStateChange(Sender: TObject);
  protected
    procedure GridDblClicked;virtual;
  public
    Grid : TDHTMLXGrid;
    Popup : TDHTMLXPopup;
    constructor Create(aPopupParams : JSValue;aTable,aRow,aHeader,aColIDs,aFilter : string);
    procedure DoFilter(aFilter : string;DoSelect : Boolean = false);
    procedure DoShowPopup;virtual;
    property DataSet : TAvammDataset read FDataSet;
    property Filter : string read FFilter write FFilter;
    property OnDblClick : TNotifyEvent read FDblClick write FDblClick;
  end;

  function CheckSaved(Toolbar : TDHTMLXToolbar) : TJSPromise;

resourcestring
  strRefresh                   = 'Aktualisieren';
  strLoadingFailed             = 'Fehler beim laden von Daten vom Server';
  strSave                      = 'Speichern';
  strAbort                     = 'Abbrechen';
  strNumber                    = 'Nummer';
  strNumberNote                = 'Die Nummer des Eintrages';
  strNumberTooltip             = 'geben Sie hier die Id ein.';
  strShorttext                 = 'Kurztext';
  strShorttextNote             = 'Der Kurztext des Eintrages';
  strShorttextTooltip          = 'geben Sie hier den Kurztext ein.';
  strItemNotFound              = 'Der gewünschte Eintrag wurde nicht gefunden, oder Sie benötigen das Recht diesen zu sehen';
  strPrint                     = 'Drucken';
  strFilterTT                  = 'Filter an/auschalten';
  strHistory                   = 'Verlauf';
  strReallyCancel              = 'Änderungen verwerfen ?';
  strYes                       = 'Ja';
  strNo                        = 'Nein';
  strNew                       = 'Neu';
  strDelete                    = 'Löschen';

implementation

uses AvammWiki;

function CheckSaved(Toolbar : TDHTMLXToolbar) : TJSPromise;
  procedure CheckPromise(resolve, reject: TJSPromiseResolver);
    procedure DoCheckIt(par : Boolean);
    begin
      if par then
        resolve(true)
      else reject(false);
    end;
  begin
    if Toolbar.isEnabled('save') then
      begin
        dhtmlx.message(js.new(['type','confirm',
                               'text',strReallyCancel,
                               'cancel',strNo,
                               'ok',strYes,
                               'callback',@DoCheckIt]));
      end
    else
      resolve(True);
  end;

begin
  Result := TJSPromise.new(@CheckPromise);
end;

{ TAvammContentForm }

constructor TAvammContentForm.Create(aParent: TJSElement);
begin
  FParent := aParent;
  FContainer := TJSHTMLElement(document.createElement('div'));
  FContainer.style.setProperty('height','100%');
  FContainer.style.setProperty('width','100%');
  aParent.appendChild(FContainer);
end;

procedure TAvammContentForm.Show;
begin
  DoShow;
end;

procedure TAvammContentForm.DoShow;
var
  i: Integer;
begin
  for i := 0 to FParent.childNodes.length-1 do
    TJSHTMLElement(FParent.childNodes.item(i)).style.setProperty('display','none');;
  FContainer.style.setProperty('display','block');
end;

{ TAvammForm }

procedure TAvammForm.DoLoadData;
begin
  DoLoadHistory;
  Layout.cells('a').setHeight(90);
end;

procedure TAvammForm.DoLoadHistory;
var
  i: Integer;
  History, nEntry: TJSArray;
begin
  History := TJSArray(TJSObject(Data.Properties['HISTORY']).Properties['Data']);
  gHistory.clearAll;
  for i := 0 to History.Length-1 do
    begin
      nEntry := TJSArray.new;
      nEntry.push(GetBaseUrl+'/icons/'+string(TJSObject(History[i]).Properties['ACTIONICON'])+'.png');
      nEntry.push(stringreplace(string(TJSObject(History[i]).Properties['ACTION']),#13,'<br>',[rfReplaceAll]));
      nEntry.push(TJSObject(History[i]).Properties['REFERENCE']);
      nEntry.push(TJSObject(History[i]).Properties['CHANGEDBY']);
      nEntry.push(TJSObject(History[i]).Properties['DATE']);
      gHistory.addRow(TJSObject(History[i]).Properties['sql_id'],nEntry);
    end;
end;

procedure TAvammForm.SetTitle(aTitle: string);
begin
  if FWindow is TJSWindow then
    TJSWindow(FWindow).document.title:=aTitle
  else
    TDHTMLXWindowsCell(FWindow).setText(aTitle);
end;

function TAvammForm.DoClose: Boolean;
var
  tmp: String;
  function IntDoSave(aValue: JSValue): JSValue;
  begin
    DoSave;
  end;
  function IntDoNothing(aValue: JSValue): JSValue;
  begin
  end;
begin
  CheckSaved(Toolbar)._then(@IntDoSave).catch(@IntDoNothing);
  try
    if pos(string(Id),THashHistory(Router.History).getHash)>0 then
      begin
        tmp := copy(THashHistory(Router.History).getHash,0,pos('/',copy(THashHistory(Router.History).getHash,2,255))+1);
        THashHistory(Router.History).replaceHash('');
      end;
  except
  end;
  Result := True;
end;

procedure TAvammForm.Refresh;
  function AddReports(aValue: TJSXMLHttpRequest): JSValue;
  var
    i: Integer;
    aName, aExt: String;
  begin
    Reports := TJSArray(TJSJSON.parse(aValue.responseText));
    Toolbar.addButtonSelect('print',3,strPrint,TJSArray.new,'fa fa-print','fa fa-print');
    for i := 0 to Reports.length-1 do
      begin
        aName := string(TJSObject(Reports[i]).Properties['name']);
        aExt := copy(aName,pos('.',aName)+1,length(aName));
        aName := copy(aName,0,pos('.',aName)-1);
        if aExt = 'pdf' then
          begin
            //addListoption
          end;
      end;
  end;
  function ReportsCouldntbeLoaded(aValue: JSValue): JSValue;
  begin
    writeln('error loading report');
  end;
  function WikiFormLoaded(aValue: TJSXMLHttpRequest): JSValue;
  var
    aName: String;
    aFrame: TJSWindow;
    cDiv: TJSElement;
  begin
    aName := aValue.responseURL;
    while pos('/',aName)>0 do
      aName := copy(aName,pos('/',aName)+1,length(aName));
    aName := copy(aName,0,pos('.',aName)-1);
    if pos('<body></body>',aValue.responseText)=0 then //Add Tab only when not clear
      begin
        cDiv := document.createElement('div');
        cDiv.innerHTML:=aValue.responseText;
        FixWikiContent(TJSHTMLElement(cDiv),Self);
        try //dont raise when Tabs dont exists anymore
          if aName = 'overview' then
            Tabs.addTab(aName,aName,null,0,true,false)
          else
            Tabs.addTab(aName,aName,null,5,false,false);
          Tabs.cells(aName).appendObject(cDiv);
          if cDiv.querySelector('title') <> null then
            Tabs.cells(aName).setText(cDiv.querySelector('title').innerText);
        except
        end;
      end;
  end;
  function AddWiki(aValue: TJSXMLHttpRequest): JSValue;
  var
    Wiki: TJSArray;
    aName, aExt: String;
    i: Integer;
  begin
    //Wiki Forms Loaded
    Wiki := TJSArray(TJSJSON.parse(aValue.responseText));
    for i := 0 to Wiki.length-1 do
      begin
        aName := string(TJSObject(Wiki[i]).Properties['name']);
        aExt := copy(aName,pos('.',aName)+1,length(aName));
        if aExt = 'html' then
          begin
            LoadData('/'+Tablename+'/by-id/'+string(Id)+'/'+aName,False,'text/html',7000)._then(TJSPromiseResolver(@WikiFormLoaded));
          end;
      end;
  end;
  function WikiCouldntbeLoaded(aValue: JSValue): JSValue;
  begin
  end;
  function ItemLoaded2(aValue: JSValue): JSValue;
  begin
    WikiLoaded := LoadData('/'+Tablename+'/by-id/'+string(Id)+'/.json')._then(TJSPromiseresolver(@AddWiki))
                                                                 .catch(@WikiCouldntbeLoaded);
    ReportsLoaded := LoadData('/'+Tablename+'/by-id/'+string(Id)+'/reports/.json')._then(TJSPromiseresolver(@AddReports))
                                                                 .catch(@ReportsCouldntbeLoaded);
    try //dont raise when Form is not existing anymore (closed or not found Item)
      DoLoadData;
    except
    end;
  end;
  function ItemLoaded(aValue: JSValue): JSValue;
  var
    Fields: TJSObject;
  begin
    FRawData := TJSObject(TJSJSON.parse(TJSXMLHttpRequest(aValue).responseText));
    FData := TJSObject(TJSObject(FRawData).Properties[Uppercase(Tablename)]);
    FData := TJSObject(TJSArray(Data.Properties['Data']).Elements[0]);
    Fields := FData;
    if Fields.Properties['NAME'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['NAME']))
    else if Fields.Properties['SHORTTEXT'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['SHORTTEXT']))
    else if Fields.Properties['SUBJECT'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['SUBJECT']))
    else if Fields.Properties['SUMMARY'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['SUMMARY']));
    if Fields.Properties['ID'] <> null then
      begin
        Form.setItemValue('eId',string(Fields.Properties['ID']));
        Form.showItem('eId');
      end
    else Form.hideItem('eId');
    BaseId := Form.getItemValue('eId');
    if string(Form.getItemValue('eShorttext'))<>'' then
      Form.showItem('eShorttext');
    SetTitle(string(Form.getItemValue('eShorttext')));
    Layout.progressOff;
  end;
  function ItemLoadError(aValue: JSValue): JSValue;
  begin
    Layout.progressOff;
    dhtmlx.message(js.new(['type','error',
                           'text',strItemnotFound]));
    if FWindow is TJSWindow then
      TJSWindow(FWindow).close
    else TDHTMLXWindowsCell(FWindow).close;
  end;
begin
  Avamm.LoadData('/'+FTablename+'/by-id/'+string(Id)+'/item.json?mode=extjs')._then(@ItemLoaded)
                                                                .catch(@ItemLoadError)
                                                                ._then(@ItemLoaded2);
end;

procedure TAvammForm.DoSave;
begin
end;

constructor TAvammForm.Create(mode: TAvammFormMode; aDataSet: string;
  Id: JSValue;Params : string = '');
  procedure ToolbarButtonClick(id : string);
  begin
    if (id='save') then
      begin
        DoSave;
      end
    else if (id='abort') then
      begin
        Refresh;
      end;
  end;
  function WindowCreated(Event: TEventListenerEvent): boolean;
  var
    a, b: TDHTMLXLayoutCell;
  begin
    if FWindow is TJSWindow then
      begin
        asm
          Self.FWindow.pas.Avamm.AvammLogin = pas.Avamm.AvammLogin;
        end;
      end;
    writeln('new Window loaded');
    Layout := TDHTMLXLayout.New(js.new(['parent',FParent,'pattern','2E']));
    a := Layout.cells('a');
    a.hideHeader;
    b := Layout.cells('b');
    b.hideHeader;
    Layout.setSeparatorSize(0,5);
    Layout.setOffsets(js.new(['left',0,'top',0,'right',0,'bottom',0]));
    Toolbar := TDHTMLXToolbar(a.attachToolbar(js.new(['iconset','awesome'])));
    Toolbar.addButton('save',0,strSave,'fa fa-save','fa fa-save');
    Toolbar.addButton('abort',0,strAbort,'fa fa-cancel','fa fa-cancel');
    Toolbar.attachEvent('onClick', @ToolbarButtonClick);
    Toolbar.disableItem('save');
    Toolbar.disableItem('abort');
    Form := TDHTMLXForm(a.attachForm(js.new([])));
    Form.addItem(null,new(['type','block',
                                'width','auto',
                                'name','aBlock']));
    Form.addItem('aBlock',new(['type','input',
                           'label', strNumber,
                           'name','eId',
                           'readonly',true,
                           'hidden',true,
                           'inputWidth',100,
                           'note',strNumberNote,
                           'tooltip',strNumberTooltip]));
    Form.addItem('aBlock',new(['type','newcolumn']));
    Form.addItem('aBlock',new(['type','input',
                           'label', strShorttext,
                           'name','eShorttext',
                           'readonly',true,
                           'hidden',true,
                           'inputWidth',400,
                           'note',strShorttextNote,
                           'tooltip',strShorttextTooltip]));
    a.setHeight(0);
    Tabs := TDHTMLXTabbar(b.attachTabbar(js.new([
      'mode','top',           // string, optional, top or bottom tabs mode
      'align','left',         // string, optional, left or right tabs align
      'close_button','true',  // boolean, opt., render Close button on tabs
      'content_zone','true',  // boolean, opt., enable/disable content zone
      'arrows_mode','auto'    // mode of showing tabs arrows (auto, always)
      ])));
    Tabs.setSizes;
    Tabs.addTab('history',strHistory,nil,1,true,false);
    gHistory := TDHTMLXGrid(Tabs.cells('history').attachGrid(js.new([])));
    gHistory.setHeader('Icon,Eintrag,Referenz,ersteller,Datum');
    gHistory.setColumnIds('ACTIONICON,ACTION,REFERENCE,CHANGEDDBY,DATE');
    gHistory.setImagesPath('/images/');
    gHistory.setColTypes('img,txt,txt,txt,txt');
    gHistory.setInitWidths('30,*,100,80,120');
    gHistory.enableMultiline(true);
    gHistory.enableAutoWidth(true);
    gHistory.enableKeyboardSupport(true);
    gHistory.init();
    Layout.progressOn;
    Refresh;
  end;
begin
  //Create Window/Tab
  FWindow := null;
  FParams := TStringList.Create;
  FParams.Delimiter:='&';
  if Params<>'' then
    FParams.DelimitedText:=Params;
  FID := Id;
  FTablename:=aDataSet;
  if (mode = fmTab)
  or (mode = fmWindow)
  then
    begin
      if  (not dhx.isChrome)
      and (not dhx.isIE)
      then
        begin
          case mode of
          fmTab:FWindow := window.open(window.location.protocol+window.location.pathname+'#/'+Tablename+'/by-id/'+string(Id)+'/','_blank');
          fmWindow:FWindow := window.open(window.location.protocol+window.location.pathname+'#/'+Tablename+'/by-id/'+string(Id)+'/','_top');
          end;
          if FWindow<>null then
            begin
              FParent := TJSWindow(FWindow).document.body;
              TJSWindow(FWindow).onload:=@WindowCreated;
            end;
        end;
    end;
  if FWindow = null then
    begin
      FWindow := Windows.createWindow(Id,10,10,810,610);
      with TDHTMLXWindowsCell(FWindow) do
        begin
          attachEvent('onClose',@DoClose);
          maximize;
          setText('...');
          FParent := FWindow;
          WindowCreated(TEventListenerEvent(null));
        end;
    end;
end;

{ TAvammAutoComplete }

procedure TAvammAutoComplete.FDataSourceStateChange(Sender: TObject);
begin
  if FDataSet.Active then
    if (FDataSet.RecordCount>0) then
      begin
        DoShowPopup;
      end;
end;

procedure TAvammAutoComplete.GridDblClicked;
begin
  if Assigned(FDblClick) then
    begin
      FDblClick(Self);
      Popup.hide;
    end;
end;

constructor TAvammAutoComplete.Create(aPopupParams: JSValue; aTable, aRow,
  aHeader, aColIDs, aFilter: string);
  var
    ppId: Integer;

  procedure PopupShowed;
  begin
    Grid.attachEvent('onRowDblClicked',@GridDblClicked);
    Popup.detachEvent(ppId);
  end;

begin
  IsLoading:=False;
  Popup := TDHTMLXPopup.new(aPopupParams);
  Grid := TDHTMLXGrid(Popup.attachGrid(300,200));
  FPopupParams:=aPopupParams;
  with Grid do
    begin
      //setImagesPath('codebase/imgs/');
      setSizes();
      enableAlterCss('even','uneven');
      setHeader(aHeader);
      setColumnIds(aColIDs);
      init;
    end;
  FDataSource := TDataSource.Create(nil);
  FDataLink := TDHTMLXDataLink.Create;
  FDataLink.IdField:='sql_id';
  FDataSet := TAvammDataset.Create(nil,aTable);
  FDataSource.DataSet := FDataSet;
  FDataSource.OnStateChange:=@FDataSourceStateChange;
  FDataLink.DataSource := FDataSource;
  FFilter:=aFilter;
  Grid.sync(FDataLink.Datastore);
  ppId := Popup.attachEvent('onShow',@PopupShowed);
end;

procedure TAvammAutoComplete.DoFilter(aFilter: string; DoSelect: Boolean);
  procedure DataLoaded(DataSet: TDataSet; Data: JSValue);
  begin
    IsLoading:=False;
  end;
  procedure ResetInput;
  var
    nFilter: String;
  begin
    if IsLoading then
      begin
        window.clearTimeout(aTimer);
        aTimer := window.setTimeout(@ResetInput,600);
      end
    else
      begin
        nFilter := StringReplace(Filter,'FILTERVALUE',aFilter,[rfReplaceAll,rfIgnoreCase]);
        if nFilter<>FDataSet.ServerFilter then
          begin
            FDataSet.ServerFilter:=nFilter;
            FDataSet.Load([],@DataLoaded);
            IsLoading := True;
          end;
      end;
  end;
begin
  window.clearTimeout(aTimer);
  aTimer := window.setTimeout(@ResetInput,600);
  FSelect := DoSelect;
end;

procedure TAvammAutoComplete.DoShowPopup;
begin
  if (not Popup.isVisible()) then
    begin
      Popup.show(TJSArray(TJSObject(FPopupParams).Properties['id']).Elements[0]);
      if (FSelect) then Grid.selectRow(0);
    end;
end;

{ TAvammListForm }

constructor TAvammListForm.Create(aParent: TJSElement; aDataSet: string;
  aPattern: string);
  procedure FilterStart(indexes,values : TJSArray);
  var
    i: Integer;
  begin
    FOldFilter := '';
    if Assigned(indexes) then
      for i := 0 to indexes.length do
        begin
          if (values[i]) then
            FOldFilter := FOldFilter+' AND lower("'+string(Grid.getColumnId(Integer(indexes[i])))+'")'+' like lower(''%'+string(values[i])+'%'')';
        end;
    FOldFilter := copy(FOldFilter,6,length(FOldFilter));
    writeln('Filter:'+FOldFilter);
    Page.progressOn();
    try
      {$ifdef DEBUG}console.log('Setting Server Filter');{$endif}
      FDataSet.ServerFilter:=FOldFilter;
      FDataSet.OnLoadFail:=@FDataSetLoadFail;
      {$ifdef DEBUG}console.log('Loading Data');{$endif}
      FDataSet.Load([],@SwitchProgressOff);
    except
      Page.progressOff();
    end;
  end;
  procedure StateChange(id : string;state : Boolean);
  begin
    if (id='filter') then
      begin
        if state then
          begin
            Grid.attachHeader(FFilterHeader);
            Grid.setSizes;
          end
        else
          begin
            Grid.detachHeader(1);
            FilterStart(TJSArray(null),TJSArray(null));
          end;
      end;
  end;
  procedure DoResizeLayout;
  begin
    Page.setSizes;
  end;
begin
  inherited Create(aParent);
  writeln('Loading '+aDataSet+' as List...');
  window.addEventListener('ContainerResized',@DoResizeLayout);
  Page := TDHTMLXLayout.New(js.new(['parent',FContainer,'pattern',aPattern]));
  Page.cont.style.setProperty('border-width','0');
  Page.cells('a').hideHeader;
  Toolbar := TDHTMLXToolbar(Page.cells('a').attachToolbar(js.new(['parent',Page,
                                                       'iconset','awesome'])));
  Toolbar.addButton('refresh',0,'','fa fa-refresh','fa fa-refresh');
  Toolbar.setItemToolTip('refresh',strRefresh);
  Toolbar.attachEvent('onClick', @ToolbarButtonClick);
  Toolbar.attachEvent('onStateChange', @StateChange);
  FTableName:=aDataSet;
  Grid := TDHTMLXGrid(Page.cells('a').attachGrid(js.new([])));
  Grid.setImagesPath('codebase/imgs/');
  Grid.setSizes();
  Grid.enableAlterCss('even','uneven');
  Grid.setEditable(false);
  Grid.attachEvent('onFilterStart',@FilterStart);
  Grid.init();
  FDataSource := TDataSource.Create(nil);
  FDataLink := TDHTMLXDataLink.Create;
  FDataLink.IdField:='sql_id';
  FDataSet := TAvammDataset.Create(nil,aDataSet);
  FDataSource.DataSet := FDataSet;
  FDataLink.DataSource := FDataSource;
  //FDataLink.DataProcessor.init(Grid);
  Grid.attachEvent('onRowDblClicked',@DoRowDblClick);
  Grid.sync(FDataLink.Datastore);
end;
procedure TAvammListForm.Show;
begin
  DoShow;
  Page.setSizes;
  RefreshList;
end;
procedure TAvammListForm.SwitchProgressOff(DataSet: TDataSet; Data: JSValue);
begin
  Page.progressOff();
end;

function TAvammListForm.DoRowDblClick: Boolean;
begin
  Result := False;
  router.Push(FTableName+'/by-id/'+string(Grid.getSelectedRowId())+'/');
end;

procedure TAvammListForm.ToolbarButtonClick(id: string);
begin
  if (id='new') then
    begin
    end
  else if (id='refresh') then
    RefreshList;
end;

procedure TAvammListForm.FDataSetLoadFail(DataSet: TDataSet; ID: Integer;
  const ErrorMsg: String);
begin
  Page.progressOff;
  dhtmlx.message(js.new(['type','error',
                           'text',strLoadingFailed+' '+ErrorMsg]));
end;

procedure TAvammListForm.SetFilterHeader(AValue: string);
begin
  if FFilterHeader=AValue then Exit;
  FFilterHeader:=AValue;
  if AValue<>'' then
    begin
      Toolbar.addButtonTwoState('filter',0,'','fa fa-filter','fa fa-filter');
      Toolbar.setItemToolTip('filter',strFilterTT);
    end
  else
    Toolbar.removeItem('filter');
end;

procedure TAvammListForm.RefreshList;
begin
  try
    Page.progressOn();
    FDataSet.Load([],@SwitchProgressOff);
  except
    on e : Exception do
      begin
        writeln('Refresh Exception:'+e.message);
        Page.progressOff();
      end;
  end;
end;

end.

