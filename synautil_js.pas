unit synautil_js;

{$mode objfpc}{$H+}

interface

uses
  Classes, SysUtils;

function DecodeRfcDateTime(Value: string): TDateTime;
function Rfc822DateTime(t: TDateTime): string;
function TimeZoneBias : Integer;

implementation

function TimeZoneBias : Integer;
begin
asm
  var d = new Date();
  Result = d.getTimezoneOffset();
end;
end;

function TrimSPLeft(const S: string): string;
var
  I, L: Integer;
begin
  Result := '';
  if S = '' then
    Exit;
  L := Length(S);
  I := 1;
  while (I <= L) and (S[I] = ' ') do
    Inc(I);
  Result := Copy(S, I, Maxint);
end;
function TrimSPRight(const S: string): string;
var
  I: Integer;
begin
  Result := '';
  if S = '' then
    Exit;
  I := Length(S);
  while (I > 0) and (S[I] = ' ') do
    Dec(I);
  Result := Copy(S, 1, I);
end;
function TrimSP(const S: string): string;
begin
  Result := TrimSPLeft(s);
  Result := TrimSPRight(Result);
end;
function SeparateLeft(const Value, Delimiter: string): string;
var
  x: Integer;
begin
  x := Pos(Delimiter, Value);
  if x < 1 then
    Result := Value
  else
    Result := Copy(Value, 1, x - 1);
end;
function SeparateRight(const Value, Delimiter: string): string;
var
  x: Integer;
begin
  x := Pos(Delimiter, Value);
  if x > 0 then
    x := x + Length(Delimiter) - 1;
  Result := Copy(Value, x + 1, Length(Value) - x);
end;
function FetchBin(var Value: string; const Delimiter: string): string;
var
  s: string;
begin
  Result := SeparateLeft(Value, Delimiter);
  s := SeparateRight(Value, Delimiter);
  if s = Value then
    Value := ''
  else
    Value := s;
end;
function Fetch(var Value: string; const Delimiter: string): string;
begin
  Result := FetchBin(Value, Delimiter);
  Result := TrimSP(Result);
  Value := TrimSP(Value);
end;
function FetchEx(var Value: string; const Delimiter, Quotation: string): string;
var
  b: Boolean;
begin
  Result := '';
  b := False;
  while Length(Value) > 0 do
  begin
    if b then
    begin
      if Pos(Quotation, Value) = 1 then
        b := False;
      Result := Result + Value[1];
      Delete(Value, 1, 1);
    end
    else
    begin
      if Pos(Delimiter, Value) = 1 then
      begin
        Delete(Value, 1, Length(delimiter));
        break;
      end;
      b := Pos(Quotation, Value) = 1;
      Result := Result + Value[1];
      Delete(Value, 1, 1);
    end;
  end;
end;
function DecodeTimeZone(Value: string; var Zone: integer): Boolean;
var
  x: integer;
  zh, zm: integer;
  s: string;
begin
  Result := false;
  s := Value;
  if (Pos('+', s) = 1) or (Pos('-',s) = 1) then
  begin
    if s = '-0000' then
      Zone := TimeZoneBias
    else
      if Length(s) > 4 then
      begin
        zh := StrToIntdef(s[2] + s[3], 0);
        zm := StrToIntdef(s[4] + s[5], 0);
        zone := zh * 60 + zm;
        if s[1] = '-' then
          zone := zone * (-1);
      end;
    Result := True;
  end
  else
  begin
    x := 32767;
    if s = 'NZDT' then x := 13;
    if s = 'IDLE' then x := 12;
    if s = 'NZST' then x := 12;
    if s = 'NZT' then x := 12;
    if s = 'EADT' then x := 11;
    if s = 'GST' then x := 10;
    if s = 'JST' then x := 9;
    if s = 'CCT' then x := 8;
    if s = 'WADT' then x := 8;
    if s = 'WAST' then x := 7;
    if s = 'ZP6' then x := 6;
    if s = 'ZP5' then x := 5;
    if s = 'ZP4' then x := 4;
    if s = 'BT' then x := 3;
    if s = 'EET' then x := 2;
    if s = 'MEST' then x := 2;
    if s = 'MESZ' then x := 2;
    if s = 'SST' then x := 2;
    if s = 'FST' then x := 2;
    if s = 'CEST' then x := 2;
    if s = 'CET' then x := 1;
    if s = 'FWT' then x := 1;
    if s = 'MET' then x := 1;
    if s = 'MEWT' then x := 1;
    if s = 'SWT' then x := 1;
    if s = 'UT' then x := 0;
    if s = 'UTC' then x := 0;
    if s = 'GMT' then x := 0;
    if s = 'WET' then x := 0;
    if s = 'WAT' then x := -1;
    if s = 'BST' then x := -1;
    if s = 'AT' then x := -2;
    if s = 'ADT' then x := -3;
    if s = 'AST' then x := -4;
    if s = 'EDT' then x := -4;
    if s = 'EST' then x := -5;
    if s = 'CDT' then x := -5;
    if s = 'CST' then x := -6;
    if s = 'MDT' then x := -6;
    if s = 'MST' then x := -7;
    if s = 'PDT' then x := -7;
    if s = 'PST' then x := -8;
    if s = 'YDT' then x := -8;
    if s = 'YST' then x := -9;
    if s = 'HDT' then x := -9;
    if s = 'AHST' then x := -10;
    if s = 'CAT' then x := -10;
    if s = 'HST' then x := -10;
    if s = 'EAST' then x := -10;
    if s = 'NT' then x := -11;
    if s = 'IDLW' then x := -12;
    if x <> 32767 then
    begin
      zone := x * 60;
      Result := True;
    end;
  end;
end;
function RPosEx(const Sub, Value: string; From: integer): Integer;
var
  n: Integer;
  l: Integer;
begin
  result := 0;
  l := Length(Sub);
  for n := From - l + 1 downto 1 do
  begin
    if Copy(Value, n, l) = Sub then
    begin
      result := n;
      break;
    end;
  end;
end;
function RPos(const Sub, Value: String): Integer;
begin
  Result := RPosEx(Sub, Value, Length(Value));
end;
function GetTimeFromStr(Value: string): TDateTime;
var
  x: integer;
begin
  x := rpos(':', Value);
  if (x > 0) and ((Length(Value) - x) > 2) then
    Value := Copy(Value, 1, x + 2);
  Value := StringReplace(Value, ':', {$IFDEF COMPILER15_UP}FormatSettings.{$ENDIF}TimeSeparator,[rfReplaceAll]);
  Result := -1;
  try
    Result := StrToTime(Value);
  except
    on Exception do ;
  end;
end;
function GetMonthNumber(Value: String): integer;
var
  n: integer;
  function TestMonth(Value: String; Index: Integer): Boolean;
  var
    n: integer;
  begin
    Result := False;
    for n := 0 to 6 do
      if Value = Uppercase(ShortMonthNames[Index]) then
      begin
        Result := True;
        Break;
      end;
  end;
begin
  Result := 0;
  Value := Uppercase(Value);
  for n := 1 to 12 do
    if TestMonth(Value, n) or (Value = Uppercase(ShortMonthNames[n])) then
    begin
      Result := n;
      Break;
    end;
end;
function DecodeRfcDateTime(Value: string): TDateTime;
var
  day, month, year: Word;
  zone: integer;
  x, y: integer;
  s: string;
  t: TDateTime;
begin
// ddd, d mmm yyyy hh:mm:ss
// ddd, d mmm yy hh:mm:ss
// ddd, mmm d yyyy hh:mm:ss
// ddd mmm dd hh:mm:ss yyyy
// Sun, 06 Nov 1994 08:49:37 GMT    ; RFC 822, updated by RFC 1123
// Sunday, 06-Nov-94 08:49:37 GMT   ; RFC 850, obsoleted by RFC 1036
// Sun Nov  6 08:49:37 1994         ; ANSI C's asctime() Format

  Result := 0;
  if Value = '' then
    Exit;
  day := 0;
  month := 0;
  year := 0;
  zone := 0;
  Value := StringReplace(Value, ' -', ' #',[rfReplaceAll]);
  Value := StringReplace(Value, '-', ' ',[rfReplaceAll]);
  Value := StringReplace(Value, ' #', ' -',[rfReplaceAll]);
  while Value <> '' do
  begin
    s := Fetch(Value, ' ');
    s := uppercase(s);
    // timezone
    if DecodetimeZone(s, x) then
    begin
      zone := x;
      continue;
    end;
    x := StrToIntDef(s, 0);
    // day or year
    if x > 0 then
      if (x < 32) and (day = 0) then
      begin
        day := x;
        continue;
      end
      else
      begin
        if (year = 0) and ((month > 0) or (x > 12)) then
        begin
          year := x;
          if year < 32 then
            year := year + 2000;
          if year < 1000 then
           year := year + 1900;
          continue;
        end;
      end;
    // time
    if rpos(':', s) > Pos(':', s) then
    begin
      t := GetTimeFromStr(s);
      if t <> -1 then
        Result := t;
      continue;
    end;
    //timezone daylight saving time
    if s = 'DST' then
    begin
      zone := zone + 60;
      continue;
    end;
    // month
    y := GetMonthNumber(s);
    if (y > 0) and (month = 0) then
      month := y;
  end;
  if year = 0 then
    year := 1980;
  if month < 1 then
    month := 1;
  if month > 12 then
    month := 12;
  if day < 1 then
    day := 1;
  x := MonthDays[IsLeapYear(year), month];
  if day > x then
    day := x;
  Result := Result + Encodedate(year, month, day);
  zone := zone - TimeZoneBias;
  x := zone div 1440;
  Result := Result - x;
  zone := zone mod 1440;
  t := EncodeTime(Abs(zone) div 60, Abs(zone) mod 60, 0, 0);
  if zone < 0 then
    t := 0 - t;
  Result := Result - t;
end;
function TimeZone: string;
var
  bias: Integer;
  h, m: Integer;
begin
  bias := TimeZoneBias;
  if bias >= 0 then
    Result := '+'
  else
    Result := '-';
  bias := Abs(bias);
  h := bias div 60;
  m := bias mod 60;
  Result := Result + Format('%.2d%.2d', [h, m]);
end;
function Rfc822DateTime(t: TDateTime): string;
var
  wYear, wMonth, wDay: word;
begin
  DecodeDate(t, wYear, wMonth, wDay);
  Result := Format('%s, %d %s %s %s', [ShortDayNames[DayOfWeek(t)], wDay,
    ShortMonthNames[wMonth], FormatDateTime('yyyy hh":"nn":"ss', t), TimeZone]);
end;

end.

