"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, Download, Eye, FileText, LayoutDashboard, LockKeyhole, MessageSquare, Pencil, Search, ShieldCheck, X } from "lucide-react";
import { Area as AreaRaw, AreaChart, Bar as BarRaw, BarChart, CartesianGrid, Cell, Pie as PieRaw, PieChart, ResponsiveContainer, Tooltip as TooltipRaw, XAxis as XAxisRaw, YAxis as YAxisRaw } from "recharts";
import { localISODate, teacherApi, type ClassDashboard, type TeacherClass } from "@/lib/teacher-api";
import { api } from "@/lib/api";
import { ChartCard, EmptyState, Skeleton, StatCard } from "@/components/ui";
import { ATTENDANCE_COLORS, ActiveDonutShape, DonutChart, DonutLegend, GENDER_COLORS, PerformanceRing } from "@/components/donut-chart";

const Area = AreaRaw as unknown as React.ComponentType<Record<string, unknown>>;
const Bar = BarRaw as unknown as React.ComponentType<Record<string, unknown>>;
const Pie = PieRaw as unknown as React.ComponentType<Record<string, unknown>>;
const Tooltip = TooltipRaw as unknown as React.ComponentType<Record<string, unknown>>;
const XAxis = XAxisRaw as unknown as React.ComponentType<Record<string, unknown>>;
const YAxis = YAxisRaw as unknown as React.ComponentType<Record<string, unknown>>;

function Heading(p:{eyebrow?:string;title:string;description?:string;children?:React.ReactNode}){return <div className="page-heading"><div><div className="eyebrow">{p.eyebrow||"ACADEMIC PORTAL"}</div><h1>{p.title}</h1>{p.description&&<p>{p.description}</p>}</div>{p.children&&<div className="actions">{p.children}</div>}</div>}
function Button(p:{children:React.ReactNode;primary?:boolean;href?:string;onClick?:()=>void;disabled?:boolean}){const c="btn "+(p.primary?"btn-primary":"btn-soft");return p.href?<Link className={c} href={p.href}>{p.children}</Link>:<button className={c} onClick={p.onClick} disabled={p.disabled}>{p.children}</button>}
function refreshClassScope(qc:ReturnType<typeof useQueryClient>,classId:string){qc.invalidateQueries({queryKey:["teacher","classes"]});if(!classId)return;qc.invalidateQueries({queryKey:["dashboard",classId]});qc.invalidateQueries({queryKey:["teacher","dashboard",classId]});qc.invalidateQueries({queryKey:["results-roster",classId]});qc.invalidateQueries({queryKey:["attendance"]});}
function Loading(){return <div className="panel"><p className="muted">Loading live data…</p></div>}
function ErrorBox({message}:{message:string}){return <div className="notice"><ShieldCheck size={18}/><span>{message}</span></div>}
function Stats({items}:{items:Array<[string,string,string]>}){return <div className="stat-grid">{items.map(x=><div className="stat-card" key={x[0]}><div className="stat-label">{x[0]}</div><div className="stat-value">{x[1]}</div><div className="stat-hint">{x[2]}</div></div>)}</div>}
function Table({headers,rows}:{headers:string[];rows:string[][]}){return <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{headers[0]==="Roll"&&j===0?<span className="muted">#{v}</span>:v}</td>)}</tr>)}</tbody></table></div>}
function ClassSelect({classes,value,onChange}:{classes:TeacherClass[];value:string;onChange:(v:string)=>void}){return <select className="select" value={value} onChange={e=>onChange(e.target.value)}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}{c.section?" — "+c.section:""}</option>)}</select>}

function TeacherHeader({ title, eyebrow, description }: { title: string; eyebrow: string; description: string }) {
  return (
    <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#e6e2f8] bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#77749d]">{eyebrow}</div>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeecff] text-[#272757]"><LayoutDashboard size={22} /></div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#151444]">{title}</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-[#77748d]">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button onClick={() => window.print()} className="btn btn-plain"><Download size={16} /> Export</button>
        <Link href="/teacher/attendance" className="btn btn-primary"><ClipboardCheck size={16} /> Mark Attendance</Link>
      </div>
    </div>
  );
}

function shortClassName(c: TeacherClass): string {
  return c.section ? `${c.name} ${c.section}` : c.name;
}

function Dashboard(){
  const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});
  const today=localISODate();
  const schedule=useQuery({queryKey:["schedule",today],queryFn:()=>teacherApi.schedule(today,new Date().toTimeString().slice(0,5)),refetchInterval:60000});
  const classIds=useMemo(()=>(classes.data||[]).map((c)=>c.id),[classes.data]);
  const dashboards=useQueries({queries:classIds.map((id)=>({queryKey:["teacher","dashboard",id],queryFn:()=>teacherApi.classDashboard(id),enabled:classIds.length>0,staleTime:30000}))});
  const attendanceQueries=useQueries({queries:classIds.map((id)=>({queryKey:["attendance","class",id],queryFn:()=>teacherApi.attendance({classId:id}),enabled:classIds.length>0,staleTime:30000}))});
  const [pinnedGender,setPinnedGender]=useState<string|null>(null);
  const [hoverGender,setHoverGender]=useState<string|null>(null);
  const [pinnedAttendance,setPinnedAttendance]=useState<string|null>(null);
  const [hoverAttendance,setHoverAttendance]=useState<string|null>(null);
  if(classes.isError)return <div><TeacherHeader title="Teacher Dashboard" eyebrow="EduNest / Teacher Workspace" description="A live overview of your classes, students, attendance, and performance." /><div style={{marginTop:16}}><ErrorBox message="The dashboard could not load from the EduNest API. Check that the backend is running and your teacher session is valid." /></div></div>;
  const classRows=classes.data||[], slots=schedule.data?.data||[];
  const boards=dashboards.map((d)=>d.data).filter((d):d is ClassDashboard=>Boolean(d));
  const pending=dashboards.some((d)=>d.isPending||d.isLoading);
  const boardsError=dashboards.some((d)=>d.isError);
  const hint=boardsError?"API unavailable":"Live teacher report";
  const loading=classes.isLoading||(pending&&boards.length===0);
  let total=0, male=0, female=0, other=0;
  let attWeight=0, attWeightedSum=0, perfWeight=0, perfWeightedSum=0;
  for(const board of boards){
    total+=board.total;
    male+=board.genderCounts.M; female+=board.genderCounts.F; other+=board.genderCounts.O;
    attWeight+=board.attendanceSummary.studentsWithData;
    attWeightedSum+=board.attendanceSummary.averagePercent*board.attendanceSummary.studentsWithData;
    perfWeight+=board.performanceSummary.studentsWithData;
    perfWeightedSum+=board.performanceSummary.averagePercent*board.performanceSummary.studentsWithData;
  }
  const avgAttendance=attWeight?Math.round(attWeightedSum/attWeight):null;
  const avgPerformance=perfWeight?Math.round(perfWeightedSum/perfWeight):null;
  const gender=[{name:"Boys",value:male},{name:"Girls",value:female},{name:"Other",value:other}];
  const genderPieData=gender.filter((d)=>d.value>0);
  const genderTotal=male+female+other;
  const dominantGender=gender.reduce((max,g)=>g.value>max.value?g:max,gender[0]);
  const activeGenderName=hoverGender??pinnedGender;
  const activeGenderEntry=gender.find((g)=>g.name===activeGenderName&&g.value>0);
  const displayedGender=activeGenderEntry??dominantGender;
  const displayedGenderIndex=Math.max(0,gender.findIndex((g)=>g.name===displayedGender.name));
  const displayedGenderPct=genderTotal>0?Math.round((displayedGender.value/genderTotal)*100):0;
  const displayedGenderColor=GENDER_COLORS[displayedGenderIndex%GENDER_COLORS.length];
  const activeGenderIndex=Math.max(0,genderPieData.findIndex((entry)=>entry.name===displayedGender.name));
  const handleGenderPieEnter=(_:unknown,index:unknown)=>{const i=Number(index);if(Number.isFinite(i)&&genderPieData[i])setHoverGender(genderPieData[i].name);};
  const handleGenderPieLeave=()=>setHoverGender(null);
  const handleGenderPieClick=(_:unknown,index:unknown)=>{const i=Number(index);if(!Number.isFinite(i)||!genderPieData[i])return;const name=genderPieData[i].name;setPinnedGender((prev)=>prev===name?null:name);};
  const strengthTrend=classRows.map((c)=>{const board=boards.find((b)=>b.classId===c.id);return {name:shortClassName(c),value:board?board.total:(c.studentCount??0)};});
  const performanceByClass=boards.map((d)=>{const c=classRows.find((x)=>x.id===d.classId);return {name:c?shortClassName(c):d.classId.slice(0,6),value:d.performanceSummary.averagePercent};});
  let presentCount=0, absentCount=0, leaveCount=0;
  for(const attQ of attendanceQueries){
    for(const doc of attQ.data||[]){
      for(const r of doc.records){
        if(r.status==="present")presentCount++;
        else if(r.status==="absent")absentCount++;
        else leaveCount++;
      }
    }
  }
  const attendanceData=[{name:"Present",value:presentCount},{name:"Absent",value:absentCount},{name:"Leave",value:leaveCount}];
  const attendancePieData=attendanceData.filter((d)=>d.value>0);
  const attendanceTotal=presentCount+absentCount+leaveCount;
  const attendanceLoading=attendanceQueries.some((q)=>q.isLoading||q.isPending);
  const attendanceError=attendanceQueries.some((q)=>q.isError);
  const dominantAttendance=attendanceData.reduce((max,a)=>a.value>max.value?a:max,attendanceData[0]);
  const activeAttendanceName=hoverAttendance??pinnedAttendance;
  const activeAttendanceEntry=attendanceData.find((a)=>a.name===activeAttendanceName&&a.value>0);
  const displayedAttendance=activeAttendanceEntry??dominantAttendance;
  const displayedAttendanceIndex=Math.max(0,attendanceData.findIndex((a)=>a.name===displayedAttendance.name));
  const displayedAttendancePct=attendanceTotal>0?Math.round((displayedAttendance.value/attendanceTotal)*100):0;
  const displayedAttendanceColor=ATTENDANCE_COLORS[displayedAttendanceIndex%ATTENDANCE_COLORS.length];
  const activeAttendanceIndex=Math.max(0,attendancePieData.findIndex((entry)=>entry.name===displayedAttendance.name));
  const handleAttendancePieEnter=(_:unknown,index:unknown)=>{const i=Number(index);if(Number.isFinite(i)&&attendancePieData[i])setHoverAttendance(attendancePieData[i].name);};
  const handleAttendancePieLeave=()=>setHoverAttendance(null);
  const handleAttendancePieClick=(_:unknown,index:unknown)=>{const i=Number(index);if(!Number.isFinite(i)||!attendancePieData[i])return;const name=attendancePieData[i].name;setPinnedAttendance((prev)=>prev===name?null:name);};
  return <div>
    <TeacherHeader title="Teacher Dashboard" eyebrow="EduNest / Teacher Workspace" description="A live overview of your classes, students, attendance, and performance." />
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
      <StatCard title="Total Students" value={loading?"…":String(total)} hint={hint} />
      <StatCard title="My Classes" value={String(classRows.length)} hint={hint} />
      <StatCard title="Average Attendance" value={avgAttendance===null?(loading?"…":"—"):`${avgAttendance}%`} hint={hint} />
      <StatCard title="Average Performance" value={avgPerformance===null?(loading?"…":"—"):`${avgPerformance}%`} hint={hint} />
      <StatCard title="Boys / Girls" value={loading?"…":`${male} / ${female}`} hint={other?`Boys / Girls · Other: ${other}`:"Boys / Girls"} />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
      <ChartCard title="Class strength">
        <div className="h-64">
          {loading?<Skeleton className="h-full w-full" />:classRows.length===0?<EmptyState title="No classes assigned" />:(
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={strengthTrend}>
                <CartesianGrid stroke="#ebe8fa" vertical={false} />
                <XAxis dataKey="name" stroke="#8783a7" />
                <YAxis stroke="#8783a7" />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#272757" fill="#dfddfa" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
      <ChartCard title="Gender ratio" action={<span className="text-xs text-[#57558b]">{genderTotal>0?`${genderTotal} students`:"Awaiting data"}</span>}>
        <div className="flex flex-col items-center gap-4 @sm:flex-row @sm:items-center @sm:gap-2">
          {loading?<Skeleton className="h-64 w-full" />:genderTotal===0?<EmptyState title={boardsError?"Unable to load student data":"No gender data"} />:(
            <><div className="relative h-64 min-w-0 w-full @sm:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderPieData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={4} labelLine={false} activeIndex={activeGenderIndex} activeShape={ActiveDonutShape} onMouseEnter={handleGenderPieEnter} onMouseLeave={handleGenderPieLeave} onClick={handleGenderPieClick} style={{cursor:"pointer"}}>
                    {genderPieData.map((entry)=>{const fullIndex=gender.findIndex((d)=>d.name===entry.name);return <Cell key={entry.name} fill={GENDER_COLORS[fullIndex>=0?fullIndex:0]} style={{cursor:"pointer"}} />;})}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-semibold text-[#57558b]">{displayedGender.name}</span>
                <span className="font-display text-3xl font-bold tabular-nums" style={{color:displayedGenderColor}}>{displayedGenderPct}%</span>
              </div>
            </div><DonutLegend items={gender} colors={GENDER_COLORS} activeName={displayedGender.name} onHover={(name)=>setHoverGender(name)} onSelect={(name)=>setPinnedGender((prev)=>prev===name?null:name)} /></>
          )}
        </div>
      </ChartCard>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <ChartCard title="Performance by class" action={<span className="text-xs text-[#13855b]">{avgPerformance!==null?`${avgPerformance}% average`:"Awaiting data"}</span>}>
        <div className="h-56">
          {loading?<Skeleton className="h-full w-full" />:boards.length===0?<EmptyState title={boardsError?"Unable to load performance":"No performance data"} />:(
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceByClass}>
                <CartesianGrid stroke="#ebe8fa" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#272757" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
      <ChartCard title="Attendance overview" action={<span className="text-xs text-[#13855b]">{attendanceTotal>0?`${attendanceTotal} marked`:"Awaiting data"}</span>}>
        <div className="flex flex-col items-center gap-4 @sm:flex-row @sm:items-center @sm:gap-2">
          {loading||attendanceLoading?<Skeleton className="h-56 w-full" />:attendanceError?<EmptyState title="Unable to load attendance" />:attendanceTotal===0?<EmptyState title={boardsError?"Unable to load attendance":"No attendance data"} />:(
            <><div className="relative h-56 min-w-0 w-full @sm:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attendancePieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4} activeIndex={activeAttendanceIndex} activeShape={ActiveDonutShape} onMouseEnter={handleAttendancePieEnter} onMouseLeave={handleAttendancePieLeave} onClick={handleAttendancePieClick} style={{cursor:"pointer"}}>
                    {attendancePieData.map((entry)=>{const fullIndex=attendanceData.findIndex((d)=>d.name===entry.name);return <Cell key={entry.name} fill={ATTENDANCE_COLORS[fullIndex>=0?fullIndex:0]} style={{cursor:"pointer"}} />;})}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-semibold text-[#57558b]">{displayedAttendance.name}</span>
                <span className="font-display text-3xl font-bold tabular-nums" style={{color:displayedAttendanceColor}}>{displayedAttendancePct}%</span>
              </div>
            </div><DonutLegend items={attendanceData} colors={ATTENDANCE_COLORS} activeName={displayedAttendance.name} onHover={(name)=>setHoverAttendance(name)} onSelect={(name)=>setPinnedAttendance((prev)=>prev===name?null:name)} /></>
          )}
        </div>
      </ChartCard>
    </div>
    <div className="panel" style={{marginTop:20}}><div className="panel-head"><h2>Today&apos;s Schedule</h2><span className="tag">{schedule.data?.day||""}</span></div>{slots.length?<div className="queue">{slots.map(s=><div className="queue-item" key={s.id}><div className="queue-icon"><ClipboardCheck size={18}/></div><div><h3>{s.startTime}–{s.endTime} · {s.subject}</h3><p>{s.room||"Room not specified"} · {s.state}{s.covering?" · Covering":""}</p></div><Button href={"/teacher/classes/"+s.classId}>{s.state==="LIVE"?"Open live class":"View class"} <ArrowRight size={14}/></Button></div>)}</div>:<p className="muted">{schedule.isLoading?"Loading today’s schedule…":schedule.isError?"Schedule unavailable. Check that the backend is running.":"No timetable entries returned for today."}</p>}</div>
    <div className="class-grid" style={{marginTop:18}}>{classRows.map(c=><div className="class-card" key={c.id}><span className="tag">Assigned Class</span><h3 style={{marginTop:12}}>{c.name}{c.section?" — "+c.section:""}</h3><div className="class-meta">{c.academicYear||"Current academic year"}<br/>{c.studentCount??"—"} enrolled students</div><Button primary href={"/teacher/classes/"+c.id}>View Class Dashboard <ArrowRight size={15}/></Button></div>)}</div>
  </div>;
}

function Classes(){
  const q=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});
  if(q.isLoading)return <Loading/>; if(q.isError)return <ErrorBox message="Unable to load assigned classes from GET /teacher/classes."/>; const rows=q.data||[];
  return <><Heading title="My Classes" description="Assigned classes returned by the teacher-scoped API."><Button primary><Download size={15}/> Export</Button></Heading><Stats items={[["Assigned Classes",String(rows.length),"Teacher scope"],["Total Students",String(rows.reduce((a,c)=>a+(c.studentCount||0),0)),"API response"],["Academic Year",rows[0]?.academicYear||"—","Current session"],["Access","Teacher","Own classes only"]]}/><div className="class-grid">{rows.map(c=><div className="class-card" key={c.id}><h3>{c.name}{c.section?" — "+c.section:""}</h3><span className="tag">Teacher assigned</span><div className="class-meta">Standard: {c.standard||"—"}<br/>Academic year: {c.academicYear||"—"}<br/>{c.studentCount??"—"} enrolled students</div><Button primary href={"/teacher/classes/"+c.id}>View Class Dashboard <ArrowRight size={15}/></Button></div>)}</div></>
}

function ClassDetail(){
  const params=useParams<{id:string}>(); const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes}); const id=params.id||"";
  const q=useQuery({queryKey:["dashboard",id],queryFn:()=>teacherApi.classDashboard(id),enabled:Boolean(id)});
  const [month,setMonth]=useState("all");
  const [query,setQuery]=useState("");
  const attQ=useQuery({queryKey:["attendance","class",id],queryFn:()=>teacherApi.attendance({classId:id}),enabled:Boolean(id)});
  const docs=useMemo(()=>attQ.data||[],[attQ.data]);
  const months=useMemo(()=>Array.from(new Set(docs.map(x=>x.date.slice(0,7)))).sort().reverse(),[docs]);
  if(classes.isLoading||q.isLoading)return <Loading/>; if(classes.isError||q.isError)return <ErrorBox message="This class is unavailable or is not assigned to the authenticated teacher."/>; const d=q.data as ClassDashboard; const c=classes.data?.find(x=>x.id===d.classId);
  const scoped=month==="all"?docs:docs.filter(x=>x.date.startsWith(month));
  let present=0,absent=0,leave=0;
  for(const doc of scoped){ for(const r of doc.records){ if(r.status==="present")present++; else if(r.status==="absent")absent++; else leave++; } }
  const genderTotal=d.genderCounts.M+d.genderCounts.F+d.genderCounts.O;
  const attendanceTotal=present+absent+leave;
  const gender=[{name:"Boys",value:d.genderCounts.M},{name:"Girls",value:d.genderCounts.F},{name:"Other",value:d.genderCounts.O}];
  const attendanceData=[{name:"Present",value:present},{name:"Absent",value:absent},{name:"Leave",value:leave}];
  const qn=query.trim().toLowerCase();
  const filteredRoster=qn?d.roster.filter(s=>(s.name||"").toLowerCase().includes(qn)||((s.loginId||s.id||"").toLowerCase().includes(qn))):d.roster;
  const classTitle=c?(c.name+(c.section?" — "+c.section:"")):"Class Dashboard";
  const classMeta=[c?.academicYear||"Current academic year",d.total+" students"].join("  •  ");
  return <>
    <Heading eyebrow="MY CLASSES  •  ACTIVE COHORT" title={classTitle} description={classMeta+" — live gender split and Present / Absent / Leave breakdown with full roster."}><Button href="/teacher/attendance"><ClipboardCheck size={15}/> Take Attendance</Button><Button href="/teacher/notices">Post Class Notice</Button></Heading>
    <Stats items={[["Enrollment",String(d.total),"Active students"],["Average Attendance",d.attendanceSummary.averagePercent+"%",d.attendanceSummary.studentsWithData+" students with records"],["Boys / Girls",d.genderCounts.M+" / "+d.genderCounts.F,d.genderCounts.O?("Other: "+d.genderCounts.O):"Gender split"],["Marked",String(attendanceTotal),month==="all"?"All-time records":"Records in "+month]]}/>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <ChartCard title="Gender ratio" action={<span className="text-xs text-[#57558b]">{genderTotal>0?genderTotal+" students":"Awaiting data"}</span>}>
        {genderTotal===0?<EmptyState title="No gender data" />:(<DonutChart items={gender} colors={GENDER_COLORS} heightClass="h-64" innerRadius={64} outerRadius={92} />)}
      </ChartCard>
      <ChartCard title="Attendance" action={<select className="select" style={{minHeight:34}} value={month} onChange={e=>setMonth(e.target.value)} aria-label="Attendance month"><option value="all">All time</option>{months.map(m=><option key={m} value={m}>{m}</option>)}</select>}>
        {attQ.isLoading?<Skeleton className="h-64 w-full" />:attQ.isError?<EmptyState title="Unable to load attendance" />:scoped.length===0?<EmptyState title="No attendance data" />:(<DonutChart items={attendanceData} colors={ATTENDANCE_COLORS} heightClass="h-64" innerRadius={64} outerRadius={92} />)}
      </ChartCard>
    </div>
    <div className="panel" style={{marginTop:20}}>
      <div className="panel-head"><div><h2>Student Roster</h2><span className="muted">{filteredRoster.length} of {d.roster.length} • Sorted by roll number</span></div><span className="tag">{d.total} enrolled</span></div>
      <div className="toolbar" style={{marginTop:0}}><div className="search-input"><Search size={15}/><input placeholder="Search student name or ID" value={query} onChange={e=>setQuery(e.target.value)} /></div><span className="status">{filteredRoster.length} shown</span></div>
      {filteredRoster.length===0?<EmptyState title={d.roster.length===0?"No students enrolled":"No students match search"} />:(<div className="table-wrap"><table className="data-table"><thead><tr><th>Roll</th><th>Student Name</th><th>Student ID</th><th>Gender</th><th>Fee Status</th><th>Performance %</th><th>Attendance %</th><th>Profile</th></tr></thead><tbody>{filteredRoster.map(s=><tr key={s.id}><td><span className="muted">#{s.rollNo??"—"}</span></td><td>{s.name}</td><td>{s.loginId||s.id}</td><td>{s.gender||"—"}</td><td>{s.feeStatus||"—"}</td><td>{s.performancePercent}</td><td>{s.attendancePercent}</td><td><Link className="btn btn-soft" style={{padding:"7px 10px",fontSize:11}} href={"/teacher/students/"+s.id+"?classId="+d.classId}><Eye size={14}/> View</Link></td></tr>)}</tbody></table></div>)}
    </div>
    <div className="notice"><ShieldCheck size={18}/><span>Attendance is calculated from saved Present / Absent / Leave records. Performance is calculated from published results, with saved test marks used until publication.</span></div>
  </>;
}

type MarkStatus="present"|"absent"|"leave";

function StatusToggle({value,onChange,disabled}:{value:MarkStatus;onChange:(s:MarkStatus)=>void;disabled:boolean}){
  const btn=(s:MarkStatus,label:React.ReactNode,title:string,active:string)=>(<button key={s} type="button" title={title} aria-label={title} aria-pressed={value===s} disabled={disabled} onClick={()=>onChange(s)} className={"mark-btn"+(value===s?" "+active:"")}>{label}</button>);
  return <div className="mark-group">{btn("present",<Check size={16}/>,"Present","is-present")}{btn("absent",<X size={16}/>,"Absent","is-absent")}{btn("leave",<span className="mark-bang">!</span>,"Informed leave","is-leave")}</div>;
}

function StatusBadge({value}:{value:MarkStatus}){
  const label=value==="present"?"Present":value==="absent"?"Absent":"On leave";
  const icon=value==="present"?<Check size={13}/>:value==="absent"?<X size={13}/>:<span className="mark-bang" style={{fontSize:12}}>!</span>;
  return <span className={"mark-badge is-"+value}>{icon}{label}</span>;
}

function Attendance(){
  const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});
  const [classId,setClassId]=useState(""); const [date,setDate]=useState(localISODate());
  const [periodId,setPeriodId]=useState(""); const [editing,setEditing]=useState(true);
  const [marks,setMarks]=useState<Record<string,MarkStatus>>({}); const [appliedKey,setAppliedKey]=useState("");
  const rosterQ=useQuery({queryKey:["dashboard",classId],queryFn:()=>teacherApi.classDashboard(classId),enabled:Boolean(classId)});
  const docsQ=useQuery({queryKey:["attendance",classId,date],queryFn:()=>teacherApi.attendance({classId,date}),enabled:Boolean(classId)});
  const schedQ=useQuery({queryKey:["schedule",date],queryFn:()=>teacherApi.schedule(date,new Date().toTimeString().slice(0,5)),enabled:Boolean(classId)});
  const qc=useQueryClient();
  const save=useMutation({mutationFn:(body:{id?:string;create:{classId:string;date:string;periodId:string;records:Array<{studentId:string;status:MarkStatus}>};records:Array<{studentId:string;status:MarkStatus}>})=>body.id?teacherApi.updateAttendance(body.id,body.records):teacherApi.markAttendance(body.create),onSuccess:()=>{toast.success("Attendance saved.");qc.invalidateQueries({queryKey:["attendance"]});refreshClassScope(qc,classId)},onError:e=>toast.error(e instanceof Error?e.message:"Attendance save failed")});
  const roster=rosterQ.data?.roster||[]; const docs=docsQ.data||[];
  const slots=(schedQ.data?.data||[]).filter(s=>s.classId===classId);
  const noTimetable=Boolean(classId)&&!schedQ.isLoading&&!schedQ.isError&&slots.length===0;
  // Default period: LIVE slot first, else first slot of the day.
  useEffect(()=>{ if(classId&&!periodId&&slots.length){ const live=slots.find(s=>s.state==="LIVE"); setPeriodId((live||slots[0]).id); } },[classId,periodId,slots.map(s=>s.id).join(",")]);
  const activeDoc=docs.find(d=>d.periodId===periodId);
  // Seed marks from the saved doc, else default the whole roster to present. Keyed so refetches never clobber unsaved edits.
  useEffect(()=>{
    if(!classId||!roster.length) return;
    const key=classId+"|"+date+"|"+periodId+"|"+roster.length+"|"+docs.length+"|"+(activeDoc?activeDoc.records.map(r=>r.studentId+":"+r.status).join(","):"new");
    if(key===appliedKey) return;
    const base:Record<string,MarkStatus>={};
    if(activeDoc){ for(const r of activeDoc.records) base[r.studentId]=r.status; }
    else { for(const s of roster) base[s.id]="present"; }
    setMarks(base); setAppliedKey(key); setEditing(!activeDoc);
  },[classId,date,periodId,roster.length,docs.length,activeDoc,appliedKey,roster]);
  if(classes.isLoading)return <Loading/>;
  const counts={present:0,absent:0,leave:0};
  for(const s of roster){ const v=marks[s.id]; if(v==="present")counts.present++; else if(v==="absent")counts.absent++; else if(v==="leave")counts.leave++; }
  const setOne=(id:string,v:MarkStatus)=>setMarks(m=>({...m,[id]:v}));
  const markAll=(v:MarkStatus)=>{ const next:Record<string,MarkStatus>={}; for(const s of roster) next[s.id]=v; setMarks(next); };
  const onSave=()=>{
    if(!classId||!periodId){ toast.error(slots.length?"Select a period first.":"No periods scheduled for this date — ask admin to add a timetable."); return; }
    const records=roster.map(s=>({studentId:s.id,status:marks[s.id]||"present"}));
    save.mutate({id:activeDoc?.id,create:{classId,date,periodId,records},records});
  };
  return <><Heading title="Daily Attendance Roster" description="Select a class to load its full roster. Tick ✓ present, cross ✕ absent, ! informed leave."><Button primary onClick={()=>markAll("present")} disabled={!editing||save.isPending||noTimetable}><LockKeyhole size={15}/> Mark All Present</Button><Button onClick={()=>setEditing(e=>!e)} disabled={save.isPending}><Pencil size={15}/> {editing?"Done":"Edit"}</Button></Heading>
  <div className="panel"><div className="toolbar" style={{margin:0}}><ClassSelect classes={classes.data||[]} value={classId} onChange={v=>{setClassId(v);setPeriodId("");setAppliedKey("")}}/><input className="input" type="date" value={date} onChange={e=>{setDate(e.target.value);setPeriodId("");setAppliedKey("")}}/><select className="select" value={periodId} onChange={e=>setPeriodId(e.target.value)} disabled={!slots.length}><option value="">{slots.length?"Select period":"No periods this date"}</option>{slots.map(s=><option key={s.id} value={s.id}>{s.startTime}–{s.endTime} · {s.subject} ({s.state}{s.covering?", covering":""})</option>)}</select><span className="status">{docsQ.isFetching||schedQ.isFetching?"Syncing…":"API connected"}</span></div></div>
  {!classId?<div className="notice"><ShieldCheck size={18}/><span>Select a class above to load every student with tick, cross and leave controls.</span></div>:null}
  {classId&&(rosterQ.isLoading||docsQ.isLoading)?<Loading/>:null}
  {classId&&docsQ.isError?<ErrorBox message="Attendance could not be loaded for this class/date."/>:null}
  {classId&&!rosterQ.isLoading&&!noTimetable?<Stats items={[["Students",String(roster.length),"Class roster"],["Present",String(counts.present),"Ticked ✓"],["Absent",String(counts.absent),"Crossed ✕"],["On Leave",String(counts.leave),"Informed !"]]}/>:null}
  {noTimetable?<div className="notice"><ShieldCheck size={18}/><span>No timetable is assigned to this class for {date}. The student list is hidden until your admin adds a timetable slot for this date.</span></div>:null}
  {classId&&roster.length&&!noTimetable?<div className="panel"><div className="toolbar" style={{marginTop:0}}><Button onClick={()=>markAll("present")} disabled={!editing||save.isPending||noTimetable}>Mark all present</Button><Button onClick={()=>markAll("absent")} disabled={!editing||save.isPending||noTimetable}>Mark all absent</Button><Button primary onClick={onSave} disabled={!editing||save.isPending||noTimetable}>{save.isPending?"Saving…":activeDoc?"Update Attendance":"Save Attendance"}</Button></div>
  <div className="table-wrap"><table className="data-table"><thead><tr><th>Roll</th><th>Student Name</th><th>Student ID</th><th>Attendance</th></tr></thead><tbody>{roster.map(s=>{const v=marks[s.id]||"present";return <tr key={s.id}><td><span className="muted">#{s.rollNo??"—"}</span></td><td>{s.name}</td><td>{s.loginId||s.id}</td><td>{editing?<StatusToggle value={v} onChange={nv=>setOne(s.id,nv)} disabled={save.isPending}/>:<StatusBadge value={v}/>}</td></tr>})}</tbody></table></div></div>:null}
  <div className="notice"><ShieldCheck size={18}/><span>Corrections are allowed for any date in your own classes. Every save is audit-logged.</span></div></>
}

function ApiList({page}:{page:string}){
  type Config={title:string;description:string;query:()=>Promise<unknown>;headers:string[];rows:(data:unknown)=>string[][]};
  const configs:Record<string,Config>={tests:{title:"Tests & Assessments",description:"Assessments returned by GET /tests.",query:()=>teacherApi.tests(),headers:["Title","Subject","Date","Max Marks","Class"],rows:(d:unknown)=>(d as Array<Record<string,unknown>>).map(x=>[String(x.title),String(x.subject),String(x.date),String(x.maxMarks),String(x.classId)])},results:{title:"Publish Examination Results",description:"Results returned by GET /results.",query:()=>teacherApi.results(),headers:["Result","Exam","Class","Student"],rows:(d:unknown)=>(d as Array<Record<string,unknown>>).map(x=>[String(x.id||"—"),String(x.exam||"—"),String(x.classId||"—"),String(x.studentId||"—")])},fees:{title:"Class Student Fee Records",description:"Read-only fee records from GET /fees.",query:()=>teacherApi.fees(),headers:["Fee","Student","Amount","Due","Status"],rows:(d:unknown)=>(d as Array<Record<string,unknown>>).map(x=>[String(x.id||"—"),String(x.studentId||"—"),String(x.amount||"—"),String(x.dueDate||"—"),String(x.status||"—")])},salary:{title:"My Salary & Payslips",description:"Teacher-scoped payroll records from GET /salary.",query:()=>teacherApi.salary(),headers:["Payroll ID","Month","Amount","Status","Paid At"],rows:(d:unknown)=>(d as Array<Record<string,unknown>>).map(x=>[String(x.id||"—"),String(x.month||"—"),String(x.amount||"—"),String(x.status||"—"),String(x.paidAt||"—")])},notices:{title:"Notices & Circulars",description:"Notices returned by GET /notices.",query:()=>teacherApi.notices(),headers:["Notice","Audience","Type","Created"],rows:(d:unknown)=>((d as {data:Array<Record<string,unknown>>}).data||[]).map(x=>[String(x.title),String(x.audience),String(x.type),String(x.createdAt)])},complaints:{title:"Complaints & Inquiries",description:"Private teacher inbox from GET /teacher/complaints.",query:()=>teacherApi.complaints(),headers:["Complaint","Category","Status","Created"],rows:(d:unknown)=>(d as Array<Record<string,unknown>>).map(x=>[String(x.subject),String(x.category),String(x.status),String(x.createdAt)])},promote:{title:"Promote Students",description:"Promotion eligibility is server-enforced.",query:()=>teacherApi.classes(),headers:["Source Class","Class ID","Academic Year"],rows:(d:unknown)=>(d as TeacherClass[]).map(x=>[x.name,x.id,x.academicYear||"—"])}};
  const config=configs[page];
  if(!config)return <ErrorBox message="This teacher page is not connected to a backend contract yet."/>; const q=useQuery({queryKey:["teacher",page],queryFn:config.query}); if(q.isLoading)return <Loading/>; if(q.isError)return <ErrorBox message={"Unable to load "+page+" from the EduNest backend."}/>; return <><Heading title={config.title} description={config.description}><Button primary><Download size={15}/> Export</Button></Heading><div className="panel"><div className="toolbar"><div className="search-input"><Search size={15}/><input placeholder="Search live records…"/></div><span className="status">Backend data</span></div><Table headers={config.headers} rows={config.rows(q.data)}/></div></>;
}

function NewStudent(){const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});const qc=useQueryClient();const [name,setName]=useState("");const [classId,setClassId]=useState("");const [gender,setGender]=useState<"M"|"F"|"O">("F");const [cred,setCred]=useState<{loginId:string;tempPassword:string;rollNo:number}|null>(null);const create=useMutation({mutationFn:()=>teacherApi.createStudent({name,classId,gender}),onSuccess:d=>{toast.success("Student created.");setCred({loginId:d.loginId,tempPassword:d.tempPassword,rollNo:d.rollNo});refreshClassScope(qc,classId)},onError:e=>toast.error(e instanceof Error?e.message:"Student creation failed")});return <>{cred?<div className="fixed inset-0 z-[60] grid place-items-center bg-[#0d0c31]/55 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="student-cred-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0efff] text-[#29285f]"><CheckCircle2 size={21}/></div><h2 id="student-cred-title" className="mt-4 text-center font-display text-xl font-bold">Student created</h2><p className="mt-2 text-center text-sm leading-6 text-[#77748d]">Save these credentials now — they are shown once.</p><div className="mt-4 rounded-lg bg-[#FFF7ED] p-3 font-mono text-sm tabular-nums"><div>Login ID: {cred.loginId}</div><div>Password: {cred.tempPassword}</div><div>Roll: {cred.rollNo}</div></div><div className="mt-6 flex gap-3"><button type="button" onClick={()=>window.print()} className="flex-1 rounded-lg bg-[#f0efff] px-4 py-3 text-sm font-semibold text-[#29285f]">Print</button><button type="button" onClick={()=>setCred(null)} className="flex-1 rounded-lg bg-[#29285f] px-4 py-3 text-sm font-semibold text-white">Confirm</button></div></section></div>:null}<Heading title="Register New Student" description="Create a student through POST /teacher/students. Credentials and roll number are generated by the backend."><Button primary onClick={()=>create.mutate()} disabled={create.isPending||!name||!classId}>Create Student Record</Button></Heading><div className="panel"><div className="form-grid"><div className="field"><label>Student full name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></div><div className="field"><label>Assigned class *</label><ClassSelect classes={classes.data||[]} value={classId} onChange={setClassId}/></div><div className="field"><label>Gender</label><select value={gender} onChange={e=>setGender(e.target.value as "M"|"F"|"O")}><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option></select></div></div></div></>}

function Tests(){const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});const qc=useQueryClient();const [classId,setClassId]=useState("");const [title,setTitle]=useState("");const [subject,setSubject]=useState("");const [date,setDate]=useState("");const [maxMarks,setMaxMarks]=useState("40");const create=useMutation({mutationFn:()=>teacherApi.createTest({classId,title,subject,date,maxMarks:Number(maxMarks)}),onSuccess:()=>{toast.success("Assessment created in the backend.");qc.invalidateQueries({queryKey:["tests"]});qc.invalidateQueries({queryKey:["results-tests",classId]})},onError:e=>toast.error(e instanceof Error?e.message:"Could not create assessment")});const tests=useQuery({queryKey:["tests",classId],queryFn:()=>teacherApi.tests(classId||undefined)});return <><Heading title="Tests & Assessments" description="Create and review assessments using POST /tests and GET /tests."><Button primary onClick={()=>create.mutate()} disabled={create.isPending||!classId||!title||!subject||!date}>Create Assessment</Button></Heading><div className="panel"><div className="form-grid"><div className="field"><label>Class *</label><ClassSelect classes={classes.data||[]} value={classId} onChange={setClassId}/></div><div className="field"><label>Subject *</label><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Mathematics"/></div><div className="field"><label>Test title *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Unit Test 3"/></div><div className="field"><label>Exam date *</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="field"><label>Maximum marks *</label><input type="number" min="1" value={maxMarks} onChange={e=>setMaxMarks(e.target.value)}/></div></div></div><div className="panel" style={{marginTop:18}}><h2>Live assessments</h2>{tests.isLoading?<Loading/>:tests.isError?<ErrorBox message="Assessments could not be loaded."/>:<Table headers={["Title","Subject","Date","Max Marks","Marks entry"]} rows={(tests.data||[]).map(t=>[t.title,t.subject,t.date,String(t.maxMarks),"Open marks entry"])}/>}</div></>}

function Results(){const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});const qc=useQueryClient();const [classId,setClassId]=useState("");const roster=useQuery({queryKey:["dashboard",classId],queryFn:()=>teacherApi.classDashboard(classId),enabled:Boolean(classId)});const [studentId,setStudentId]=useState("");const [exam,setExam]=useState("");const [subject,setSubject]=useState("Mathematics");const [marks,setMarks]=useState("");const publish=useMutation({mutationFn:()=>teacherApi.publishResult({classId,exam,studentId,subjects:[{name:subject,marks:Number(marks),max:40}]}),onSuccess:()=>{toast.success("Result published through the backend.");qc.invalidateQueries({queryKey:["results"]});refreshClassScope(qc,classId)},onError:e=>toast.error(e instanceof Error?e.message:"Result publication failed")});return <><Heading title="Publish Examination Results" description="Publish a validated result record with POST /results."><Button primary onClick={()=>publish.mutate()} disabled={publish.isPending||!classId||!studentId||!exam||!marks}>Publish Result</Button></Heading><div className="panel"><div className="form-grid"><div className="field"><label>Class</label><ClassSelect classes={classes.data||[]} value={classId} onChange={setClassId}/></div><div className="field"><label>Student</label><select className="select" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select student</option>{(roster.data?.roster||[]).map(s=><option key={s.id} value={s.id}>{s.name} · {s.id}</option>)}</select></div><div className="field"><label>Examination</label><input value={exam} onChange={e=>setExam(e.target.value)} placeholder="Term 1 Geometry"/></div><div className="field"><label>Subject</label><input value={subject} onChange={e=>setSubject(e.target.value)}/></div><div className="field"><label>Marks / 40</label><input type="number" min="0" max="40" value={marks} onChange={e=>setMarks(e.target.value)}/></div></div></div></>}

function Promote(){const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});const qc=useQueryClient();const [fromClassId,setFrom]=useState("");const [toClassId,setTo]=useState("");const roster=useQuery({queryKey:["dashboard",fromClassId],queryFn:()=>teacherApi.classDashboard(fromClassId),enabled:Boolean(fromClassId)});const [selected,setSelected]=useState<string[]>([]);const promote=useMutation({mutationFn:()=>teacherApi.promote({fromClassId,toClassId,studentIds:selected}),onSuccess:()=>{toast.success("Promotion submitted to the backend.");refreshClassScope(qc,fromClassId);if(toClassId)refreshClassScope(qc,toClassId)},onError:e=>toast.error(e instanceof Error?e.message:"Promotion failed")});return <><Heading title="Promote Students" description="Promotion eligibility, forward-only rules, and roll allocation are enforced by POST /promote."><Button primary onClick={()=>promote.mutate()} disabled={promote.isPending||!fromClassId||!toClassId||!selected.length}>Promote Selected ({selected.length})</Button></Heading><div className="panel"><div className="form-grid"><div className="field"><label>Source class</label><ClassSelect classes={classes.data||[]} value={fromClassId} onChange={v=>{setFrom(v);setSelected([])}}/></div><div className="field"><label>Target class</label><ClassSelect classes={(classes.data||[]).filter(c=>c.id!==fromClassId)} value={toClassId} onChange={setTo}/></div></div></div>{roster.data&&<div className="panel" style={{marginTop:18}}><Table headers={["Roll","Student","Attendance","Academic"]} rows={roster.data.roster.map(s=>[String(s.rollNo??"—"),s.name,String(s.attendancePercent),String(s.performancePercent)])}/><div className="toolbar"><Button onClick={()=>setSelected(roster.data!.roster.map(s=>s.id))}>Select all eligible</Button><Button onClick={()=>setSelected([])}>Clear selection</Button></div></div>}</>}

function NoticeComposer(){const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});const qc=useQueryClient();const [classId,setClassId]=useState("");const [title,setTitle]=useState("");const [body,setBody]=useState("");const create=useMutation({mutationFn:()=>teacherApi.createNotice({title,body,audience:"class",classId}),onSuccess:()=>{toast.success("Notice posted to the assigned class.");qc.invalidateQueries({queryKey:["notices"]})},onError:e=>toast.error(e instanceof Error?e.message:"Notice failed")});const notices=useQuery({queryKey:["notices"],queryFn:teacherApi.notices});return <><Heading title="Notices & Circulars" description="Create class-scoped notices through POST /notices."><Button primary onClick={()=>create.mutate()} disabled={create.isPending||!classId||!title||!body}>Post Notice</Button></Heading><div className="panel"><div className="form-grid"><div className="field"><label>Class</label><ClassSelect classes={classes.data||[]} value={classId} onChange={setClassId}/></div><div className="field"><label>Title</label><input value={title} onChange={e=>setTitle(e.target.value)}/></div><div className="field full"><label>Message</label><textarea value={body} onChange={e=>setBody(e.target.value)}/></div></div></div><div className="panel" style={{marginTop:18}}><h2>Live notices</h2>{notices.isLoading?<Loading/>:<Table headers={["Title","Audience","Type","Created"]} rows={(notices.data?.data||[]).map(n=>[String(n.title),String(n.audience),String(n.type),String(n.createdAt)])}/>}</div></>}

function Complaints(){const q=useQuery({queryKey:["complaints"],queryFn:teacherApi.complaints});const qc=useQueryClient();const update=useMutation({mutationFn:(id:string)=>teacherApi.updateComplaint(id,{status:"resolved",reply:"Resolved by the assigned teacher."}),onSuccess:()=>{toast.success("Complaint resolved.");qc.invalidateQueries({queryKey:["complaints"]})},onError:e=>toast.error(e instanceof Error?e.message:"Complaint update failed")});return <><Heading title="Complaints & Inquiries" description="Only complaints addressed to the authenticated teacher are returned by GET /teacher/complaints."/><div className="panel">{q.isLoading?<Loading/>:q.isError?<ErrorBox message="Complaint inbox unavailable."/>:<Table headers={["Subject","Category","Status","Created","Action"]} rows={(q.data||[]).map(x=>[String(x.subject),String(x.category),String(x.status),String(x.createdAt),String(x.status)==="resolved"?"Resolved":"Resolve from detail"])}/>}</div>{(q.data||[]).filter(x=>String(x.status)!=="resolved").map(x=><div className="toolbar" key={String(x.id)}><span>{String(x.subject)}</span><Button onClick={()=>update.mutate(String(x.id))}>Mark resolved</Button></div>)}</>}

function ResultsManagement(){
  const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});
  const [classId,setClassId]=useState(""); const [selectedTest,setSelectedTest]=useState<{id:string;title:string;subject:string;date:string;maxMarks:number}|null>(null); const [marks,setMarks]=useState<Record<string,string>>({}); const [confirmOpen,setConfirmOpen]=useState(false);
  useEffect(()=>{if(!classId&&classes.data?.[0]?.id)setClassId(classes.data[0].id)},[classId,classes.data]);
  const tests=useQuery({queryKey:["results-tests",classId],queryFn:()=>teacherApi.tests(classId),enabled:Boolean(classId)}); const results=useQuery({queryKey:["results-history",classId],queryFn:()=>teacherApi.results({classId}),enabled:Boolean(classId)}); const roster=useQuery({queryKey:["results-roster",classId],queryFn:()=>teacherApi.classDashboard(classId),enabled:Boolean(classId&&selectedTest)}); const qc=useQueryClient();
  const publish=useMutation({mutationFn:async()=>{if(!selectedTest||!roster.data)throw new Error("Select a test and class first");return Promise.all(roster.data.roster.map(s=>{const raw=marks[s.id];if(raw===undefined||raw.trim()==="")throw new Error("Enter marks for every student before publishing");const value=Number(raw);if(!Number.isFinite(value)||value<0||value>selectedTest.maxMarks)throw new Error("Marks must be between 0 and "+selectedTest.maxMarks);return teacherApi.publishResult({classId,exam:selectedTest.title,studentId:s.id,subjects:[{name:selectedTest.subject,marks:value,max:selectedTest.maxMarks}]})}))},onSuccess:()=>{toast.success("Results published by the backend.");setConfirmOpen(false);setSelectedTest(null);setMarks({});qc.invalidateQueries({queryKey:["results-history",classId]});qc.invalidateQueries({queryKey:["results"]});refreshClassScope(qc,classId)},onError:e=>toast.error(e instanceof Error?e.message:"Publishing failed")});
  if(classes.isLoading)return <Loading/>; if(classes.isError)return <ErrorBox message="Assigned classes could not be loaded."/>; const allTests=tests.data||[]; const history=results.data||[]; const pending=allTests.filter(t=>!history.some(r=>String(r.exam)===t.title)); const historyExams=Array.from(new Set(history.map(r=>String(r.exam)))); const completed=allTests.filter(t=>historyExams.includes(t.title)); const completedCount=roster.data?.roster.filter(s=>marks[s.id]!==undefined&&marks[s.id]!=="").length||0;
  return <><Heading title="Results Management" description="Manage examination results for one assigned class using the existing tests, marks, and results APIs."><Button primary onClick={()=>setConfirmOpen(true)} disabled={!selectedTest||completedCount!==(roster.data?.roster.length||0)||publish.isPending}>Publish Results</Button></Heading><div className="panel"><div className="field"><label>Class</label><ClassSelect classes={classes.data||[]} value={classId} onChange={v=>{setClassId(v);setSelectedTest(null);setMarks({})}}/></div></div>{!classId?<div className="panel"><p className="muted">Select a class to view its examinations.</p></div>:<><section style={{marginTop:22}}><div className="panel-head"><h2>Tests Without Results</h2><span className="tag">{pending.length} pending</span></div>{tests.isLoading?<Loading/>:pending.length===0?<div className="panel"><p className="muted">All test results have been published for this class.</p></div>:<div className="class-grid">{pending.sort((a,b)=>b.date.localeCompare(a.date)).map(t=><div className="class-card" key={t.id}><span className="status warn">Pending Results</span><h3 style={{marginTop:12}}>{t.title}</h3><div className="class-meta">{t.subject}<br/>{t.date||"Date not provided"}<br/>Maximum marks: {t.maxMarks}</div><Button primary onClick={()=>{setSelectedTest(t);setMarks({})}}>Enter Marks <ArrowRight size={14}/></Button></div>)}</div>}</section><div style={{borderTop:"1px solid var(--line)",margin:"30px 0 22px"}}/><section><div className="panel-head"><h2>Test History</h2><span className="tag">{completed.length} published</span></div>{history.length===0?<div className="panel"><p className="muted">No published result records were returned for this class.</p></div>:<div className="panel"><Table headers={["Test","Subject","Date","Students","Action"]} rows={completed.map(t=>[t.title,t.subject,t.date,String(history.filter(r=>String(r.exam)===t.title).length),"View Results"])}/></div>}</section></>}{selectedTest&&<div className="panel" style={{marginTop:24}}><div className="panel-head"><div><h2>Marks Entry · {selectedTest.title}</h2><span className="muted">{selectedTest.subject} · Maximum marks: {selectedTest.maxMarks}</span></div><Button onClick={()=>{setSelectedTest(null);setMarks({})}}>Cancel</Button></div>{roster.isLoading?<Loading/>:roster.isError?<ErrorBox message="Students for this class could not be loaded."/>:<><p className="muted">{completedCount} of {roster.data?.roster.length||0} students completed</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Roll No.</th><th>Student Name</th><th>Status</th><th>Enter Marks</th></tr></thead><tbody>{(roster.data?.roster||[]).map(s=>{const done=marks[s.id]!==undefined&&marks[s.id]!=="";return <tr key={s.id}><td><span className="muted">#{s.rollNo??"—"}</span></td><td>{s.name}</td><td><span className={"status"+(done?"":" warn")}>{done?"Done":"Pending"}</span></td><td><input className="input" style={{maxWidth:140}} type="number" min="0" max={selectedTest.maxMarks} step="any" placeholder={"0 – "+selectedTest.maxMarks} aria-label={"Marks for "+s.name} value={marks[s.id]||""} onChange={e=>setMarks({...marks,[s.id]:e.target.value})}/></td></tr>})}</tbody></table></div><div className="actions" style={{marginTop:18}}><Button onClick={()=>setConfirmOpen(true)} disabled={completedCount!==(roster.data?.roster.length||0)}>Publish Results</Button></div></>}</div>}{confirmOpen&&<div className="modal-backdrop" role="presentation"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="publish-title"><h2 id="publish-title">Confirm Publish Results</h2><p>Publish {selectedTest?.title} for {classes.data?.find(c=>c.id===classId)?.name||"this class"}?</p><div className="actions"><Button onClick={()=>setConfirmOpen(false)}>Cancel</Button><Button primary onClick={()=>publish.mutate()} disabled={publish.isPending}>{publish.isPending?"Publishing…":"Confirm Publish"}</Button></div></div></div>}</>
}

function StudentDetail(){
  const params=useParams<{id:string}>(); const search=useSearchParams();
  const studentId=params.id||""; const classId=search.get("classId")||"";
  const classes=useQuery({queryKey:["teacher","classes"],queryFn:teacherApi.classes});
  const dash=useQuery({queryKey:["dashboard",classId],queryFn:()=>teacherApi.classDashboard(classId),enabled:Boolean(classId)});
  const att=useQuery({queryKey:["attendance","student",classId,studentId],queryFn:()=>teacherApi.attendance({classId,studentId}),enabled:Boolean(classId&&studentId)});
  const res=useQuery({queryKey:["results","student",classId,studentId],queryFn:()=>teacherApi.results({classId,studentId}),enabled:Boolean(classId&&studentId)});
  const feeQ=useQuery({queryKey:["fees","student",studentId],queryFn:()=>teacherApi.fees({studentId}),enabled:Boolean(studentId)});
  if(!classId) return <ErrorBox message="Open this profile from a class roster so the class context is known."/>;
  if(classes.isLoading||dash.isLoading)return <Loading/>;
  if(classes.isError||dash.isError)return <ErrorBox message="This student is unavailable or is not in an assigned class."/>;
  const student=dash.data?.roster.find(s=>s.id===studentId);
  if(!student) return <ErrorBox message="Student not found in this class roster."/>;
  const cname=classes.data?.find(x=>x.id===classId);
  const records=(att.data||[]).flatMap(d=>d.records.filter(r=>r.studentId===studentId).map(r=>({date:d.date,status:String(r.status)})));
  const present=records.filter(r=>r.status==="present").length;
  const absentCount=records.filter(r=>r.status==="absent").length;
  const leaveCount=records.filter(r=>r.status!=="present"&&r.status!=="absent").length;
  const attendanceItems=[{name:"Present",value:present},{name:"Absent",value:absentCount},{name:"Leave",value:leaveCount}];
  const results=(res.data||[]).map((r,i)=>{const exam=String((r as Record<string,unknown>).exam??("Record "+(i+1)));const subs=Array.isArray((r as Record<string,unknown>).subjects)?((r as Record<string,unknown>).subjects as Array<Record<string,unknown>>).map(s=>String(s.name)+": "+String(s.marks)+"/"+String(s.max)).join(", "):"—";return [exam,subs]});
  const feeRows=(feeQ.data||[]).map(f=>{const o=f as Record<string,unknown>;return [String(o.head??"Fee"),String(o.amount??"—"),String(o.dueDate??"—"),String(o.status??"—")]});
  return <><Heading eyebrow="STUDENT PROFILE" title={student.name} description={(student.loginId||student.id)+"  •  Roll "+(student.rollNo??"—")+"  •  "+(cname?cname.name+(cname.section?" — "+cname.section:""):"Class")}><Button href={"/teacher/classes/"+classId}>Back to Class</Button><Button primary href="/teacher/attendance"><ClipboardCheck size={15}/> Take Attendance</Button></Heading>
  <Stats items={[["Attendance",String(student.attendancePercent)+"%","From class dashboard"],["Performance",String(student.performancePercent)+"%","Tests + exams"],["Fee Status",student.feeStatus||"—","Read-only mirror"],["Records",String(records.length),"Marked entries"]]}/>
  <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <ChartCard title="Attendance" action={<span className="text-xs text-[#57558b]">{records.length>0?records.length+" marked":"Awaiting data"}</span>}>
        {att.isLoading?<Skeleton className="h-64 w-full" />:att.isError?<EmptyState title="Unable to load attendance" />:records.length===0?<EmptyState title="No attendance marked for this student yet" />:(<DonutChart items={attendanceItems} colors={ATTENDANCE_COLORS} heightClass="h-64" innerRadius={64} outerRadius={92} />)}
      </ChartCard>
      <ChartCard title="Performance" action={<span className="text-xs text-[#57558b]">{student.performancePercent}% overall</span>}>
        {dash.isLoading?<Skeleton className="h-64 w-full" />:results.length===0&&student.performancePercent===0?<EmptyState title="No published results for this student yet" />:(<PerformanceRing value={student.performancePercent} heightClass="h-64" innerRadius={64} outerRadius={92} />)}
      </ChartCard>
    </div>
  <div className="panel" style={{marginTop:20}}><div className="panel-head"><h2>Attendance History</h2><span className="tag">{present}/{records.length} present</span></div>{att.isLoading?<Loading/>:att.isError?<ErrorBox message="Attendance history could not be loaded."/>:records.length===0?<p className="muted">No attendance marked for this student yet.</p>:<Table headers={["Date","Status"]} rows={records.sort((a,b)=>b.date.localeCompare(a.date)).map(r=>[r.date,r.status])}/>}</div>
  <div className="panel" style={{marginTop:18}}><div className="panel-head"><h2>Examination Results</h2><span className="tag">{results.length} records</span></div>{res.isLoading?<Loading/>:res.isError?<ErrorBox message="Results could not be loaded."/>:results.length===0?<p className="muted">No published results for this student yet.</p>:<Table headers={["Exam","Subjects"]} rows={results}/>}</div>
  <div className="panel" style={{marginTop:18}}><div className="panel-head"><h2>Fee Records</h2><span className="tag">{feeRows.length} records</span></div>{feeQ.isLoading?<Loading/>:feeQ.isError?<ErrorBox message="Fee records could not be loaded."/>:feeRows.length===0?<p className="muted">No fee records for this student yet.</p>:<Table headers={["Head","Amount","Due Date","Status"]} rows={feeRows}/>}</div></>
}

export default function TeacherPortal({page}:{page:string}){if(page==="dashboard")return <Dashboard/>;if(page==="classes")return <Classes/>;if(page==="class-detail")return <ClassDetail/>;if(page==="student-detail")return <StudentDetail/>;if(page==="attendance")return <Attendance/>;if(page==="student")return <NewStudent/>;if(page==="tests")return <Tests/>;if(page==="results")return <ResultsManagement/>;if(page==="promote")return <Promote/>;if(page==="notices")return <NoticeComposer/>;if(page==="complaints")return <Complaints/>;if(page==="profile")return <><Heading title="My Profile & Faculty Credentials" description="Authenticated teacher profile from GET /auth/me."/><div className="panel"><p>Profile identity is loaded from the current session.</p><Button primary onClick={()=>api("/auth/me").then(()=>toast.success("Session refreshed"))}>Refresh session</Button></div></>;return <ApiList page={page}/>;}
