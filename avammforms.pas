unit AvammForms;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, AvammDB, dhtmlx_form, dhtmlx_toolbar,dhtmlx_grid,
  dhtmlx_layout,dhtmlx_popup, dhtmlx_db,dhtmlx_base,dhtmlx_windows,dhtmlx_tabbar,
  webrouter, db,Avamm;

type
  { TAvammListForm }

  TAvammListForm = class
  private
    FParent : TJSElement;
    FOldFilter: String;
    FDataSource : TDataSource;
    FDataLink : TDHTMLXDataLink;
    FDataSet : TAvammDataset;
    procedure FDataSetLoadFail(DataSet: TDataSet; ID: Integer;
      const ErrorMsg: String);
    procedure SwitchProgressOff(DataSet: TDataSet; Data: JSValue);
  public
    Page : TDHTMLXLayout;
    Toolbar : TDHTMLXToolbar;
    Grid : TDHTMLXGrid;
    constructor Create(aParent : TJSElement;aDataSet : string);
    procedure Show;
    procedure RefreshList;
  end;

  TAvammFormMode = (fmTab,fmWindow,fm);

  { TAvammForm }

  TAvammForm = class
  private
    FID : JSValue;
    FTablename: string;
    FWindow: JSValue;
    FParent: JSValue;
    FData: TJSObject;
  protected
    Layout: TDHTMLXLayout;
    Form: TDHTMLXForm;
    Toolbar: TDHTMLXToolbar;
    Tabs: TDHTMLXTabbar;
    procedure DoLoadData;virtual;
    procedure SetTitle(aTitle : string);
  public
    constructor Create(mode : TAvammFormMode;aDataSet : string;Id : JSValue);
    property Id : JSValue read FID;
    property Tablename : string read FTablename;
    property Data : TJSObject read FData;
  end;

  { TAvammAutoComplete }

  TAvammAutoComplete = class
  public
    Grid : TDHTMLXGrid;
    Popup : TDHTMLXPopup;
    constructor Create(aPopupParams,aTable,aRow,aHeader,aColIDs,Filter : string;aDblClick : JSValue);
    procedure DoFilter(aFilter : string;DoSelect : Boolean);
  end;

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

implementation

{ TAvammForm }

procedure TAvammForm.DoLoadData;
begin
end;

procedure TAvammForm.SetTitle(aTitle: string);
begin
  if FWindow is TJSWindow then
    TJSWindow(FWindow).document.title:=aTitle
  else
    TDHTMLXWindowsCell(FWindow).setText(aTitle);
end;

constructor TAvammForm.Create(mode: TAvammFormMode; aDataSet: string;
  Id: JSValue);
  procedure ToolbarButtonClick(id : string);
  begin
    if (id='save') then
      begin
      end
    else if (id='abort') then
      begin
      end;
  end;
  function ItemLoaded(aValue: JSValue): JSValue;
  var
    Fields: TJSObject;
  begin
    FData := TJSObject(TJSJSON.parse(TJSXMLHttpRequest(aValue).responseText));
    Fields := TJSObject(FData.Properties['Fields']);
    if Fields.Properties['name'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['name']))
    else if Fields.Properties['shorttext'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['shorttext']))
    else if Fields.Properties['subject'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['subject']))
    else if Fields.Properties['summary'] <> null then
      Form.setItemValue('eShorttext',string(Fields.Properties['summary']))
    else Form.hideItem('eShorttext');
    if Fields.Properties['id'] <> null then
      begin
        Form.setItemValue('eId',string(Fields.Properties['id']));
        Form.showItem('eId');
      end
    else Form.hideItem('eId');
    SetTitle(string(Form.getItemValue('eShorttext')));
    Layout.progressOff;
    DoLoadData;
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
  function WindowCreated(Event: TEventListenerEvent): boolean;
  var
    a, b: TDHTMLXLayoutCell;
  begin
    writeln('new Window loaded');
    Layout := TDHTMLXLayout.New(js.new(['parent',FParent,'pattern','2E']));
    a := Layout.cells('a');
    a.hideHeader;
    a.fixSize(0,1);
    b := Layout.cells('b');
    b.hideHeader;
    Layout.setSeparatorSize(0,2);
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
                           'inputWidth',400,
                           'note',strShorttextNote,
                           'tooltip',strShorttextTooltip]));
    a.setHeight(90);
    Tabs := TDHTMLXTabbar(b.attachTabbar(js.new([
      'mode','top',           // string, optional, top or bottom tabs mode
      'align','left',         // string, optional, left or right tabs align
      'close_button','true',  // boolean, opt., render Close button on tabs
      'content_zone','true',  // boolean, opt., enable/disable content zone
      'arrows_mode','auto'    // mode of showing tabs arrows (auto, always)
      ])));
    Tabs.setSizes;
    Layout.progressOn;
    Avamm.LoadData('/'+aDataSet+'/by-id/'+string(Id)+'/item.json')._then(@ItemLoaded)
                                                          .catch(@ItemLoadError);
  end;
begin
  //Create Window/Tab
  FWindow := null;
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
          fmTab:FWindow := window.open(window.location.href,'_blank');
          fmWindow:FWindow := window.open(window.location.href,'_top');
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
      FWindow := Windows.createWindow(Id,10,10,200,200);
      with TDHTMLXWindowsCell(FWindow) do
        begin
          maximize;
          setText('...');
          FParent := FWindow;
          WindowCreated(TEventListenerEvent(null));
        end;
    end;
end;

{ TAvammAutoComplete }

constructor TAvammAutoComplete.Create(aPopupParams, aTable, aRow, aHeader,
  aColIDs, Filter: string; aDblClick: JSValue);
begin

end;

procedure TAvammAutoComplete.DoFilter(aFilter: string; DoSelect: Boolean);
  procedure ShowPopup;
  begin
    if (Grid.getRowsNum()>0) then
      begin
  	if (not Popup.isVisible()) then Popup.show('eProduct');
        if (DoSelect) then Grid.selectRow(0);
      end;
  end;
begin
  {
  if not (DataSource.loading) then
    begin
      Grid.filterBy(1,aFilter);
      if (Grid.getRowsNum()=0) then
        DataSource.FillGrid(Grid,StringReplace(Filter,'FILTERVALUE',aFilter),0,@ShowPopup);
    end;
  }
end;

{ TAvammListForm }

constructor TAvammListForm.Create(aParent : TJSElement;aDataSet: string);
  procedure ButtonClick(id : string);
  begin
    if (id='new') then
      begin
      end
    else if (id='refresh') then
      RefreshList;
  end;
  procedure FilterStart(indexes,values : TJSArray);
  var
    i: Integer;
  begin
    FOldFilter := '';
    for i := 0 to indexes.length do
      begin
        if (values[i]) then
          FOldFilter := FOldFilter+' AND lower("'+string(Grid.getColumnId(Integer(indexes[i])))+'")'+' like lower(''%'+string(values[i])+'%'')';
      end;
    FOldFilter := copy(FOldFilter,6,length(FOldFilter));
    writeln('Filter:'+FOldFilter);
    Page.progressOn();
    try
      FDataSet.ServerFilter:=FOldFilter;
      FDataSet.OnLoadFail:=@FDataSetLoadFail;
      FDataSet.Load([],@SwitchProgressOff);
    except
      Page.progressOff();
    end;
  end;
  procedure RowDblClick;
  begin
    router.Push(aDataSet+'/by-id/'+string(Grid.getSelectedRowId())+'/');
  end;
  procedure DoResizeLayout;
  begin
    Page.setSizes;
  end;
begin
  writeln('Loading '+aDataSet+' as List...');
  window.addEventListener('ContainerResized',@DoResizeLayout);
  FParent := aParent;
  Page := TDHTMLXLayout.New(js.new(['parent',aParent,'pattern','1C']));
  Page.cont.style.setProperty('border-width','0');
  Page.cells('a').hideHeader;
  Toolbar := TDHTMLXToolbar(Page.cells('a').attachToolbar(js.new(['parent',Page,
                                                       'iconset','awesome'])));
  Toolbar.addButton('refresh',0,strRefresh,'fa fa-refresh','fa fa-refresh');
  Toolbar.attachEvent('onClick', @ButtonClick);
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
  Grid.attachEvent('onRowDblClicked',@RowDblClick);
  Grid.sync(FDataLink.Datastore);
  FDataSet.Load([],@SwitchProgressOff);
end;
procedure TAvammListForm.Show;
  procedure HideElement(currentValue: TJSNode;
    currentIndex: NativeInt; list: TJSNodeList);
  begin
    TJSHTMLElement(currentValue).style.setProperty('display','none');
  end;
begin
  FParent.childNodes.forEach(@HideElement);
  Page.cont.style.setProperty('display','block');
  Page.setSizes;
end;
procedure TAvammListForm.SwitchProgressOff(DataSet: TDataSet; Data: JSValue);
begin
  Page.progressOff();
end;

procedure TAvammListForm.FDataSetLoadFail(DataSet: TDataSet; ID: Integer;
  const ErrorMsg: String);
begin
  Page.progressOff;
  dhtmlx.message(js.new(['type','error',
                           'text',strLoadingFailed+' '+ErrorMsg]));
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

