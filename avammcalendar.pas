unit avammcalendar;

{$mode objfpc}{$H+}

interface

uses
  web,JS, AvammForms, dhtmlx_scheduler, Avamm, Sysutils, synautil_js, AvammDB;

type
  TShowLightBoxEvent = procedure(Sender : TObject;id : JSValue);

  { TAvammCalenderForm }

  TAvammCalenderForm = class(TAvammListForm)
  private
    FShowLightBox: TShowLightBoxEvent;
    procedure DoLoadData; override;
    procedure DoShowLightBox(id : JSValue);
  public
    constructor Create(aParent : TJSElement;aDataSet : string;aPattern : string = 'month');override;
    property OnShowLightBox : TShowLightBoxEvent read FShowLightBox write FShowLightBox;
  end;

implementation

{ TAvammCalenderForm }

procedure TAvammCalenderForm.DoLoadData;
var
  arr : TJSArray;
  aObj: TJSObject;

  function parseData(aValue: JSValue): JSValue;
  begin
    scheduler.parse(arr,'json');
  end;
begin
  arr := TJSArray.new;
  DataSet.DisableControls;
  DataSet.First;
  while not DataSet.EOF do
    begin
      aObj := TJSObject.new;
      aObj.Properties['id'] := DataSet.FieldByName('sql_id').AsString;
      aObj.Properties['text'] := DataSet.FieldByName('SUMMARY').AsString;
      aObj.Properties['start_date'] := FormatDateTime(ShortDateFormat+' '+ShortTimeFormat,DataSet.FieldByName('STARTDATE').AsDateTime);
      aObj.Properties['end_date'] := FormatDateTime(ShortDateFormat+' '+ShortTimeFormat,DataSet.FieldByName('ENDDATE').AsDateTime);
      arr.push(aObj);
      DataSet.Next;
    end;
  DataSet.EnableControls;
  SchedulerLoaded._then(@parseData);
end;

procedure TAvammCalenderForm.DoShowLightBox(id: JSValue);
begin
  if Assigned(OnShowLightbox) then
    OnShowLightBox(Self,id);
end;

constructor TAvammCalenderForm.Create(aParent: TJSElement; aDataSet: string;
  aPattern: string);
  function CreateCalender(aValue: JSValue): JSValue;
  var
    aDiv: TJSHTMLElement;
    me : TAvammCalenderForm;
    procedure EventCreated(id,e : JSValue);
    var
      EventFields, Event: TJSObject;
      function EventSaved(aValue: JSValue): JSValue;
      begin

      end;
    begin
      writeln('Creating new Event:',id);
      EventFields := TJSObject.new;
      EventFields.Properties['id'] := string(id);
      EventFields.Properties['ID'] := string(id);
      EventFields.Properties['SUMMARY'] := 'Urlaub';
      EventFields.Properties['STARTDATE'] := BuildISODate(Now());
      EventFields.Properties['ENDDATE'] := BuildISODate(Now()+0.5);
      Event := js.new(['Fields',EventFields]);
      Avamm.StoreData('/calendar/new/item.json',TJSJSON.stringify(Event))._then(@EventSaved);
    end;
  begin
    aDiv := TJSHTMLElement(document.createElement('div'));
    aDiv.style.setProperty('height','100%');
    aDiv.style.setProperty('width','100%');
    aDiv.innerHTML:='<div id="scheduler_div" class="dhx_cal_container" style="width:100%; height:100%;">'+
                    '<div class="dhx_cal_navline">'+
                      '<div class="dhx_cal_prev_button">&nbsp;</div>'+
                      '<div class="dhx_cal_next_button">&nbsp;</div>'+
                      '<div class="dhx_cal_today_button"></div><div class="dhx_cal_date"></div>'+
                      '<div class="dhx_cal_tab" name="day_tab" style="right:204px;"></div>'+
                      '<div class="dhx_cal_tab" name="week_tab" style="right:140px;"></div>'+
                      '<div class="dhx_cal_tab" name="month_tab" style="right:76px;"></div>'+
                      '<div class="dhx_cal_tab" name="year_tab" style="right:70px;"></div>'+
                    '</div>'+
                    '<div class="dhx_cal_header"></div>'+
                      '<div class="dhx_cal_data"></div>'+
                    '</div>';
    Page.cells('a').attachObject(aDiv);
    if aPattern='' then
      aPattern:='month';
    scheduler.init('scheduler_div',TJSDate.New,aPattern);
    me := Self;
    asm
    scheduler.locale.labels.year_tab ="Year";
    scheduler.showLightbox = function(id){
      me.DoShowLightBox(id);
    }
    end;
    scheduler.attachEvent('onEventCreated',@EventCreated);
  end;
begin
  inherited Create(aParent, aDataSet, '1C');
  Grid.Destroy;
  LoadScheduler;
  SchedulerLoaded._then(@CreateCalender);
end;

end.

