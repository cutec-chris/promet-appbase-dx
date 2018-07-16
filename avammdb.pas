unit AvammDB;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, db, ExtJSDataset, Avamm, js, web, Types;

type

  { TAvammDataset }

  TAvammDataset = Class(TExtJSJSONObjectDataSet)
  private
    FDataSetName : string;
    FDataProxy: TDataProxy;
    FFieldDefsLoaded: TNotifyEvent;
    FSFilter: string;
    function GetUrl: string;
    procedure SetFilter(AValue: string);
  Protected
    Function DoGetDataProxy: TDataProxy; override;
    procedure InitDateTimeFields; override;
  Public
    constructor Create(AOwner: TComponent;aDataSet : string);
    property Url : string read GetUrl;
    property ServerFilter : string read FSFilter write SetFilter;
    function Locate(const KeyFields: string; const KeyValues: JSValue;
  Options: TLocateOptions): boolean; override;
  published
    property OnFieldDefsLoaded : TNotifyEvent read FFieldDefsLoaded write FFieldDefsLoaded;
  end;

  { TAvammDataProxy }

  TAvammDataProxy = class(TDataProxy)
  private
  protected
    Procedure CheckBatchComplete(aBatch : TRecordUpdateBatch); virtual;
  public
    constructor Create(AOwner: TComponent); override;
    function DoGetData(aRequest: TDataRequest): Boolean; override;
    function GetDataRequest(aOptions: TLoadOptions;
  aAfterRequest: TDataRequestEvent; aAfterLoad: TDatasetLoadEvent
  ): TDataRequest; override;
    function GetUpdateDescriptorClass: TRecordUpdateDescriptorClass; override;
    function ProcessUpdateBatch(aBatch: TRecordUpdateBatch): Boolean; override;
  end;

  { TAvammDataRequest }

  TAvammDataRequest = Class(TDataRequest)
  Private
    FXHR : TJSXMLHttpRequest;
  protected
    function onLoad(Event{%H-}: TEventListenerEvent): boolean; virtual;
    function TransformResult: JSValue; virtual;
  end;

  { TAvammUpdateDescriptor }

  TAvammUpdateDescriptor = Class(TRecordUpdateDescriptor)
  Private
    FXHR : TJSXMLHttpRequest;
    FBatch : TRecordUpdateBatch;
  protected
    function onLoad(Event{%H-}: TEventListenerEvent): boolean; virtual;
  end;



implementation

{ TAvammUpdateDescriptor }

function TAvammUpdateDescriptor.onLoad(Event: TEventListenerEvent): boolean;
begin
  if (FXHR.Status div 100)=2 then
    begin
      Resolve(FXHR.response);
      Result:=True;
    end
  else
    ResolveFailed(FXHR.StatusText);
  (Proxy as TAvammDataProxy).CheckBatchComplete(FBatch);
end;

{ TAvammDataRequest }

function TAvammDataRequest.onLoad(Event: TEventListenerEvent): boolean;
var
  aarr: JSValue;
begin
  if (not Assigned(Self)) then exit;
  if (FXHR.Status=200) then
    begin
    Data:=TransformResult;
    Success:=rrOK;
    end
  else
    begin
    Data:=Nil;
    if (loAtEOF in LoadOptions) and (FXHR.Status=404) then
      Success:=rrEOF
    else
      begin
      Success:=rrFail;
      if FXHR.responseText <> '' then
        ErrorMsg:=FXHR.responseText
      else ErrorMsg:=FXHR.StatusText;
      end;
    end;
  try //maybe the Dataset is already destroyed when we get this Data packet
    DoAfterRequest;
  except
  end;
  Result:=True;
end;

function TAvammDataRequest.TransformResult: JSValue;
begin
  Result:=FXHR.responseText;
end;

{ TAvammDataProxy }

procedure TAvammDataProxy.CheckBatchComplete(aBatch: TRecordUpdateBatch);
Var
  BatchOK : Boolean;
  I : Integer;
begin
  BatchOK:=True;
  I:=aBatch.List.Count-1;
  While BatchOK and (I>=0) do
    begin
    BatchOK:=aBatch.List[I].Status in [usResolved,usResolveFailed];
    Dec(I);
    end;
  If BatchOK and Assigned(aBatch.OnResolve) then
    aBatch.OnResolve(Self,aBatch);
end;

constructor TAvammDataProxy.Create(AOwner: TComponent);
begin
  inherited Create(AOwner);
end;

function TAvammDataProxy.DoGetData(aRequest: TDataRequest): Boolean;
Var
  URL : String;
  R: TAvammDataRequest;
begin
  Result:=False;
  R := TAvammDataRequest(aRequest);
  R.FXHR:=TJSXMLHttpRequest.New;
  R.FXHR.AddEventListener('load',@R.onLoad);
  URL:=TAvammDataset(Owner).Url;
  if (URL='') then
    begin
      R.Success:=rrFail;
      R.ErrorMsg:='No URL to get data';
      R.DoAfterRequest;
    end
  else
    begin
      R.FXHR.open('GET',URL,true);
      if (Avamm.AvammLogin <> '') then
        begin
          R.FXHR.setRequestHeader('Authorization','Basic ' + Avamm.AvammLogin);
        end;
      R.FXHR.send;
      Result:=True;
    end;
end;

function TAvammDataProxy.GetDataRequest(aOptions: TLoadOptions;
  aAfterRequest: TDataRequestEvent; aAfterLoad: TDatasetLoadEvent
  ): TDataRequest;
begin
  Result:=TAvammDataRequest.Create(Self,aOptions, aAfterRequest,aAfterLoad);
end;

function TAvammDataProxy.GetUpdateDescriptorClass: TRecordUpdateDescriptorClass;
begin
  Result:=TAvammUpdateDescriptor;
end;

function TAvammDataProxy.ProcessUpdateBatch(aBatch: TRecordUpdateBatch
  ): Boolean;
begin
  writeln('ProcessUpdateBatch',aBatch);
  Result := False;
end;

{ TAvammDataset }

function TAvammDataset.GetUrl: string;
begin
  Result := GetBaseUrl + '/'+FDataSetName+'/list.json?mode=extjs';
  if FSFilter <> '' then
    Result := Result+'&filter='+encodeURIComponent(FSFilter);
  Result := Result+'&dhxr=none';
end;

procedure TAvammDataset.SetFilter(AValue: string);
begin
  if FSFilter=AValue then Exit;
  FSFilter:=AValue;
  Rows := nil;
  Close;
end;

function TAvammDataset.DoGetDataProxy: TDataProxy;
begin
  Result:=FDataProxy;
end;

procedure TAvammDataset.InitDateTimeFields;
begin
  inherited InitDateTimeFields;
  if Assigned(FFieldDefsLoaded) then
    FFieldDefsLoaded(Self);
end;

constructor TAvammDataset.Create(AOwner: TComponent; aDataSet: string);
begin
  inherited Create(AOwner);
  FDataSetName := aDataSet;
  FDataProxy := TAvammDataProxy.Create(Self);
end;

function TAvammDataset.Locate(const KeyFields: string;
  const KeyValues: JSValue; Options: TLocateOptions): boolean;
begin
  Result:=inherited Locate(KeyFields, KeyValues, Options);
  //Locate is not implemented in TDataset for PAS2JS at Time
  //silly implementation that supports no Options and only one Key/Value pair
  DisableControls;
  try
    First;
    while not EOF do
      begin
        if FieldDefs.IndexOf(KeyFields)=-1 then exit;
        if FieldByName(KeyFields).AsJSValue = KeyValues then
          begin
            Result := True;
            exit;
          end;
        Next;
      end;
  finally
    EnableControls;
  end;
end;

end.

