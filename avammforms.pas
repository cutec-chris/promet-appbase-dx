unit AvammForms;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, AvammDB, dhtmlx_form, dhtmlx_toolbar,dhtmlx_grid,
  dhtmlx_layout,dhtmlx_popup, dhtmlx_db,
  webrouter, db;

type
  TAvammForm = class
  public
  end;

  { TAvammListForm }

  TAvammListForm = class
  private
    FParent : TJSElement;
    FOldFilter: String;
    FDataSource : TDataSource;
    FDataLink : TDHTMLXDataLink;
    FDataSet : TAvammDataset;
    procedure SwitchProgressOff;
  public
    Page : TDHTMLXLayout;
    Toolbar : TDHTMLXToolbar;
    Grid : TDHTMLXGrid;
    constructor Create(aParent : TJSElement;aDataSet : string);
    procedure Show;
    procedure RefreshList;
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

implementation

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
        if (values[i]<>'') then
          FOldFilter := FOldFilter+' AND lower("'+string(Grid.getColumnId(Integer(indexes[i])))+'")'+' like lower(\%'+string(values[i])+'%\)';
      end;
    FOldFilter := TJSString(FOldFilter).subString(5,TJSString(FOldFilter).length);
    Page.progressOn();
    try
      //DataSource.FillGrid(aList.Grid,OldFilter,0,@SwitchProgressOff);
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
  procedure DataLoaded(DataSet: TDataSet; Data: JSValue);
  begin
    writeln('Data Loaded called...');
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
  FDataSet := TAvammDataset.Create(nil,aDataSet);
  FDataSource.DataSet := FDataSet;
  FDataLink.DataSource := FDataSource;
  FDataLink.DataProcessor.init(Grid);
  Grid.attachEvent('onRowDblClicked',@RowDblClick);
  Grid.sync(FDataLink.Datastore);
  FDataSet.Load([],@DataLoaded);
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
procedure TAvammListForm.SwitchProgressOff;
begin
  Page.progressOff();
end;

procedure TAvammListForm.RefreshList;
begin
  try
    Page.progressOn();
    //writeln('Refresh '+FName);
    //FillGrid(Grid,OldFilter,0,@SwitchProgressOff);
  except
    on e : Exception do
      begin
        writeln('Refresh Exception:'+e.message);
        Page.progressOff();
      end;
  end;
end;

end.

