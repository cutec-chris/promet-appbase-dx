unit AvammAutocomplete;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils,js,web, AvammDB, dhtmlx_form, dhtmlx_toolbar,dhtmlx_grid,
  dhtmlx_layout,dhtmlx_popup, dhtmlx_db,dhtmlx_base,dhtmlx_windows,dhtmlx_tabbar,
  AvammRouter,webrouter, db, Avamm;

type
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
    constructor Create(aPopupParams : JSValue;aTable,aRow,aHeader,aColIDs,aFilter : string;Width: Integer = 300;Height : Integer = 200);
    procedure DoFilter(aFilter : string;DoSelect : Boolean = false);
    property Params : JSValue read FPopupParams;
    procedure DoShowPopup;virtual;
    property DataSet : TAvammDataset read FDataSet;
    property Filter : string read FFilter write FFilter;
    property OnDblClick : TNotifyEvent read FDblClick write FDblClick;
  end;

implementation

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
  aHeader, aColIDs, aFilter: string; Width: Integer; Height: Integer);
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
  Grid := TDHTMLXGrid(Popup.attachGrid(Width,Height));
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


end.

