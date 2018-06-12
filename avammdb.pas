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
  Protected
    Function DoGetDataProxy: TDataProxy; override;
  Public
    Property Connection: TRestConnection Read FConnection Write FConnection;
  end;


implementation

{ TAvammDataset }

function TAvammDataset.DoGetDataProxy: TDataProxy;
begin
  Result:=Connection.DataProxy;
end;

end.

