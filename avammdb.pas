unit AvammDB;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, db, JSONDataset, Avamm, js, web, Types;

type

  { TAvammDataset }

  TAvammDataset = Class(TBaseJSONDataset)
  private
    FDataSetName : string;
    FDataProxy: TDataProxy;
    function GetUrl: string;
  Protected
    Function DoGetDataProxy: TDataProxy; override;
    procedure MetaDataToFieldDefs; override;
    property MetaData;
  Public
    constructor Create(AOwner: TComponent;aDataSet : string);
    property Url : string read GetUrl;
    Function CreateFieldMapper : TJSONFieldMapper; override;
  end;

  { TAvammDataProxy }

  TAvammDataProxy = class(TDataProxy)
  private
  public
    constructor Create(AOwner: TComponent); override;
    function DoGetData(aRequest: TDataRequest): Boolean; override;
    function GetDataRequest(aOptions: TLoadOptions;
  aAfterRequest: TDataRequestEvent; aAfterLoad: TDatasetLoadEvent
  ): TDataRequest; override;
  end;

  { TAvammDataRequest }

  TAvammDataRequest = Class(TDataRequest)
  Private
    FXHR : TJSXMLHttpRequest;
  protected
    function onLoad(Event{%H-}: TEventListenerEvent): boolean; virtual;
    function TransformResult: JSValue; virtual;
  end;


implementation

{ TAvammDataRequest }

function TAvammDataRequest.onLoad(Event: TEventListenerEvent): boolean;
var
  aarr: JSValue;
begin
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
      ErrorMsg:=FXHR.StatusText;
      end;
    end;
  with TAvammDataset(DataProxy.Owner) do
    begin
      FieldDefs.Clear;
      aarr := TJSJSON.parse(FXHR.responseText);
      MetaData := TJSObject(TJSArray(aarr).Elements[0]);
      MetaDataToFieldDefs;
    end;
  DoAfterRequest;
  Result:=True;
end;

function TAvammDataRequest.TransformResult: JSValue;
begin
  Result:=FXHR.responseText;
end;

{ TAvammDataProxy }

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

{ TAvammDataset }

function TAvammDataset.GetUrl: string;
begin
  Result := '/'+FDataSetName+'/list.json';
end;

function TAvammDataset.DoGetDataProxy: TDataProxy;
begin
  Result:=FDataProxy;
end;

procedure TAvammDataset.MetaDataToFieldDefs;
var
  aFields: TStringDynArray;
  i: Integer;
begin
  FieldDefs.Clear;
  aFields := TJSObject.getOwnPropertyNames(Metadata);
  for i := 0 to length(aFields)-1 do
    begin
      FieldDefs.Add(aFields[i],ftString,255);
    end;
end;

constructor TAvammDataset.Create(AOwner: TComponent; aDataSet: string);
begin
  inherited Create(AOwner);
  FDataSetName := aDataSet;
  FDataProxy := TAvammDataProxy.Create(Self);
end;

function TAvammDataset.CreateFieldMapper: TJSONFieldMapper;
begin
  Result:=TJSONObjectFieldMapper.Create;
end;

end.

