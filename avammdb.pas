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
    FSFilter: string;
    function GetUrl: string;
    procedure SetFilter(AValue: string);
  Protected
    Function DoGetDataProxy: TDataProxy; override;
  Public
    constructor Create(AOwner: TComponent;aDataSet : string);
    property Url : string read GetUrl;
    property ServerFilter : string read FSFilter write SetFilter;
  published
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
      if FXHR.responseText <> '' then
        ErrorMsg:=FXHR.responseText
      else ErrorMsg:=FXHR.StatusText;
      end;
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
  Result := '/'+FDataSetName+'/list.json?mode=extjs';
  if FSFilter <> '' then
    Result := Result+'&filter='''+encodeURIComponent(FSFilter)+'''';
  Result := Result+'&dhxr=none';
end;

procedure TAvammDataset.SetFilter(AValue: string);
begin
  if FSFilter=AValue then Exit;
  FSFilter:=AValue;
  Rows := nil;
  ClearBuffers;
end;

function TAvammDataset.DoGetDataProxy: TDataProxy;
begin
  Result:=FDataProxy;
end;

constructor TAvammDataset.Create(AOwner: TComponent; aDataSet: string);
begin
  inherited Create(AOwner);
  FDataSetName := aDataSet;
  FDataProxy := TAvammDataProxy.Create(Self);
end;

end.

