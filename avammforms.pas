unit AvammForms;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, dhtmlx_form, dhtmlx_toolbar,dhtmlx_grid,
  dhtmlx_layout,dhtmlx_popup,
  webrouter;

type
  TAvammForm = class
  public
  end;

  { TAvammListForm }

  TAvammListForm = class
  private
    OldFilter: String;
    procedure SwitchProgressOff;
  public
    Page : TDHTMLXLayout;
    Toolbar : TDHTMLXToolbar;
    Grid : TDHTMLXGrid;
    constructor Create(aParent : JSValue;aDataSet : string);reintroduce;
    procedure RefreshList;
  end;

  { TAvammAutoComplete }

  TAvammAutoComplete = class
  public
    Grid : TDHTMLXGrid;
    Popup : TDHTMLXPopup;
    constructor Create(aPopupParams,aTable,aRow,aHeader,aColIDs,Filter : string;aDblClick : JSValue);reintroduce;
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

constructor TAvammListForm.Create(aParent : JSValue;aDataSet: string);
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
    OldFilter := '';
    for i := 0 to indexes.length do
      begin
        if (values[i]<>'') then
          OldFilter := OldFilter+' AND lower("'+string(Grid.getColumnId(Integer(indexes[i])))+'")'+' like lower(\%'+string(values[i])+'%\)';
      end;
    OldFilter := TJSString(OldFilter).subString(5,TJSString(OldFilter).length);
    Page.progressOn();
    try
      //DataSource.FillGrid(aList.Grid,OldFilter,0,@SwitchProgressOff);
    except
      Page.progressOff();
    end;
  end;
  procedure RowDblClick;
  begin
     Grid.getSelectedRowId()
  end;
begin
  writeln('Loading '+aDataSet+' as List...');
  Page := TDHTMLXLayout.New(js.new(['parent',aParent,'pattern','1U']));
  Toolbar := TDHTMLXToolbar(Page.attachToolbar(js.new(['parent',Page,
                                       'items',TJSArray._of([
{                                         js.new(['id','refresh',
                                                 'type', 'button',
                                                 'text', strRefresh,
                                                 'img', 'fa fa-refresh'
                                               ])}
                                               ]),
                                       'iconset','awesome'])));
  Toolbar.attachEvent('onClick', @ButtonClick);
  Grid := TDHTMLXGrid(Page.cells('a').attachGrid(js.new([])));
  Grid.setImagesPath('codebase/imgs/');
  Grid.setSizes();
  Grid.enableAlterCss('even','uneven');
  Grid.setEditable(false);
  Grid.attachEvent('onFilterStart',@FilterStart);
  Grid.init();
  //DataSource = newPrometDataStore(aName);
  //DataSource.DataProcessor.init(Grid);
  Grid.attachEvent('onRowDblClicked',@RowDblClick);
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
      writeln('Refresh Exception:'+e.message);
    Page.progressOff();
  end;
end;

end.

