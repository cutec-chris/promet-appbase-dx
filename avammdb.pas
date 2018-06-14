unit AvammDB;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils, db, RestConnection, JSONDataset;

type

  { TAvammDataset }

  TAvammDataset = Class(TBaseJSONDataset)
  private
    FConnection: TRestConnection;
    FDataSetName : string;
  Protected
    Function DoGetDataProxy: TDataProxy; override;
  Public
    constructor Create(AOwner: TComponent;aDataSet : string);
    Property Connection: TRestConnection Read FConnection Write FConnection;
  end;


implementation

{ TAvammDataset }

function TAvammDataset.DoGetDataProxy: TDataProxy;
begin
  Result:=Connection.DataProxy;
end;

constructor TAvammDataset.Create(AOwner: TComponent; aDataSet: string);
begin
  inherited Create(AOwner);
  FDataSetName := aDataSet;
end;

end.

