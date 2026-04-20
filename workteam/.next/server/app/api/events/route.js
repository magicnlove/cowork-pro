"use strict";(()=>{var e={};e.id=3873,e.ids=[3873],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},4833:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.r(t),n.d(t,{originalPathname:()=>_,patchFetch:()=>o,requestAsyncStorage:()=>c,routeModule:()=>l,serverHooks:()=>m,staticGenerationAsyncStorage:()=>p});var r=n(49303),s=n(88716),i=n(60670),d=n(3588),u=e([d]);d=(u.then?(await u)():u)[0];let l=new r.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/events/route",pathname:"/api/events",filename:"route",bundlePath:"app/api/events/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\events\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:c,staticGenerationAsyncStorage:p,serverHooks:m}=l,_="/api/events/route";function o(){return(0,i.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:p})}a()}catch(e){a(e)}})},3588:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.r(t),n.d(t,{GET:()=>R,POST:()=>g});var r=n(87070),s=n(8678),i=n(91585),d=n(26033),u=n(75748),o=n(14123),l=n(27754),c=n(61165),p=n(91978),m=e([s,u,o,l,p]);[s,u,o,l,p]=m.then?(await m)():m;let N=i.Km(["personal","team","announcement"]),S=i.Z_().min(1).refine(e=>!Number.isNaN(Date.parse(e)),{message:"유효한 날짜\xb7시간 형식이 아닙니다."}),E=i.Ry({title:i.Z_().min(1).max(500),description:i.Z_().nullable().optional(),startsAt:S,endsAt:S,kind:N,departmentId:i.Z_().uuid().nullable().optional(),attendeeUserIds:i.dj(function(e){return null==e||""===e?[]:Array.isArray(e)?e.map(e=>"string"==typeof e?e.trim():"").filter(Boolean):[]},i.IX(i.Z_().uuid()).max(50)).optional()}).superRefine((e,t)=>{"team"===e.kind&&(null==e.departmentId||""===e.departmentId)&&t.addIssue({code:d.NL.custom,message:"팀 일정에는 부서가 필요합니다.",path:["departmentId"]}),"team"!==e.kind&&null!=e.departmentId&&t.addIssue({code:d.NL.custom,message:"팀 일정에만 부서를 지정할 수 있습니다.",path:["departmentId"]})});function _(e,t,n){if(t instanceof s.DatabaseError){console.error(`[POST /api/events] ${e}`,{...n,message:t.message,code:t.code,detail:t.detail,constraint:t.constraint,table:t.table,column:t.column,severity:t.severity,position:t.position});return}console.error(`[POST /api/events] ${e}`,{...n,error:t instanceof Error?t.message:String(t),stack:t instanceof Error?t.stack:void 0})}async function y(e){return 0===e.length?[]:(await u.db.query("SELECT id::text, name, email FROM users WHERE id = ANY($1::uuid[])",[e])).rows}function f(e,t){return{id:e.id,title:e.title,description:e.description,startsAt:e.starts_at.toISOString(),endsAt:e.ends_at.toISOString(),kind:e.kind,departmentId:e.department_id,attendeeUserIds:e.attendee_user_ids??[],attendees:t,createdBy:e.created_by,createdAt:e.created_at.toISOString(),updatedAt:e.updated_at.toISOString()}}async function R(e){let t=(0,c.v6)(e);if(!t)return r.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let{searchParams:n}=new URL(e.url),a=n.get("from"),s=n.get("to");if(!a||!s)return r.NextResponse.json({message:"from, to 쿼리가 필요합니다 (YYYY-MM-DD)."},{status:400});let i=`${a}T00:00:00.000Z`,d=new Date(`${s}T00:00:00.000Z`);d.setUTCDate(d.getUTCDate()+1);let o=d.toISOString(),m=await (0,p.r)(t.sub);if(!m)return r.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let _="",R=[i,o];if("admin"===m.role)_=`
      (e.kind = 'announcement'
        OR (e.kind = 'personal' AND (e.created_by = $3::uuid OR $3::uuid = ANY(e.attendee_user_ids)))
        OR (e.kind = 'team'))
    `,R.push(m.id);else{let e=await (0,l.J)(m);_=`
      (e.kind = 'announcement'
        OR (e.kind = 'personal' AND (e.created_by = $3::uuid OR $3::uuid = ANY(e.attendee_user_ids)))
        OR (e.kind = 'team' AND e.department_id IS NOT NULL AND e.department_id = ANY($4::uuid[])))
    `,R.push(m.id,e)}let g=await u.db.query(`
    SELECT
      e.id,
      e.title,
      e.description,
      e.starts_at,
      e.ends_at,
      e.kind,
      e.department_id::text,
      e.attendee_user_ids,
      e.created_by,
      e.created_at,
      e.updated_at
    FROM events e
    WHERE e.starts_at < $2::timestamptz AND e.ends_at > $1::timestamptz
      AND (${_})
    ORDER BY e.starts_at ASC
    `,R),N=[];for(let e of g.rows){let t=await y(e.attendee_user_ids??[]);N.push(f(e,t))}return r.NextResponse.json({events:N})}async function g(e){let t,n;let a=(0,c.v6)(e);if(!a)return r.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let s=await (0,p.r)(a.sub);if(!s)return r.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});try{t=await e.json()}catch{return r.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let i=E.safeParse(t);if(!i.success)return console.error("[POST /api/events] validation failed",{issues:i.error.flatten(),bodyPreview:"object"==typeof t&&null!==t?JSON.stringify(t).slice(0,500):t}),r.NextResponse.json({message:"입력값이 올바르지 않습니다.",issues:i.error.flatten()},{status:400});let{title:d,description:m=null,startsAt:R,endsAt:g,kind:N,departmentId:S=null,attendeeUserIds:v=[]}=i.data,b="team"===N?S:null;if("team"===N&&b&&!await (0,l.d)(s,b))return r.NextResponse.json({message:"선택한 부서에 일정을 등록할 권한이 없습니다."},{status:403});if(!(new Date(R)<new Date(g)))return r.NextResponse.json({message:"종료 시간이 시작 시간보다 늦어야 합니다."},{status:400});let w=0===v.length?null:v;try{let e=await u.db.query("SELECT id::text AS id FROM users WHERE id = $1::uuid LIMIT 1",[a.sub]);if(0===e.rowCount)return console.error("[POST /api/events] created_by: no user for session.sub (JWT sub not in DB)",{sessionSub:a.sub}),r.NextResponse.json({message:"세션이 유효하지 않습니다. 다시 로그인해 주세요."},{status:401});n=e.rows[0].id}catch(e){return _("created_by lookup failed (invalid UUID or DB error)",e,{sessionSub:a.sub}),r.NextResponse.json({message:"세션 정보를 확인할 수 없습니다. 다시 로그인해 주세요."},{status:401})}console.info("[POST /api/events] inserting",{titleLen:d.length,kind:N,attendeeCount:v.length,createdByUserId:n});try{let e=(await u.db.query(`
      INSERT INTO events (
        title, description, starts_at, ends_at, kind, department_id, attendee_user_ids, created_by
      )
      VALUES (
        $1,
        $2,
        $3::timestamptz,
        $4::timestamptz,
        $5,
        $6::uuid,
        COALESCE($7::uuid[], ARRAY[]::uuid[]),
        $8::uuid
      )
      RETURNING
        id,
        title,
        description,
        starts_at,
        ends_at,
        kind,
        department_id::text,
        attendee_user_ids,
        created_by,
        created_at,
        updated_at
      `,[d,m,R,g,N,b,w,n])).rows[0],t=await y(e.attendee_user_ids??[]);return await (0,o.v)({userId:a.sub,actionType:"event_created",entityType:"event",entityId:e.id,entityName:e.title,departmentId:e.department_id,metadata:{kind:e.kind,url:"/calendar"}}),console.info("[POST /api/events] success",{eventId:e.id}),r.NextResponse.json({event:f(e,t)})}catch(e){return _("INSERT failed",e,{titleLen:d.length,kind:N,attendeeCount:v.length,createdByUserId:n}),r.NextResponse.json({message:"일정을 저장하지 못했습니다."},{status:500})}}a()}catch(e){a(e)}})},14123:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{v:()=>u});var r=n(75748),s=n(20940),i=e([r]);async function d(e){let{userId:t,actionType:n,entityType:a,entityId:i,entityName:d,departmentId:u=null,metadata:o={}}=e,l=await r.db.query(`
    INSERT INTO activity_logs (
      user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
    RETURNING id::text
    `,[t,n,a,i,d,u,JSON.stringify(o)]);(0,s.yS)("activity:new",{id:l.rows[0]?.id??null})}async function u(e){try{await d(e)}catch(e){console.error("[activity-log]",e)}}r=(i.then?(await i)():i)[0],a()}catch(e){a(e)}})},20940:(e,t,n)=>{function a(e,t){let n=globalThis.__activityIoBroadcast;try{n?.(e,t)}catch{}}function r(){a("nav:badges",{})}function s(e){a("chat:notify",e)}n.d(t,{CK:()=>s,h0:()=>r,yS:()=>a})},1923:(e,t,n)=>{n.d(t,{S:()=>r,l:()=>a});let a="auth_token",r="password_change_required"},75748:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{db:()=>i});var r=n(8678),s=e([r]);r=(s.then?(await s)():s)[0];let i=global.__pgPool??new r.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},27754:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{J:()=>i,d:()=>d});var r=n(75748),s=e([r]);async function i(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let n=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===n.length)return[...a];for(let e of(await r.db.query(`
    WITH RECURSIVE sub AS (
      SELECT id
      FROM departments
      WHERE id = ANY($1::uuid[])
      UNION ALL
      SELECT d.id
      FROM departments d
      INNER JOIN sub ON d.parent_id = sub.id
    )
    SELECT DISTINCT id::text FROM sub
    `,[n])).rows)a.add(e.id);return[...a]}async function d(e,t){return"admin"===e.role||!!t&&(await i(e)).includes(t)}r=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})},61165:(e,t,n)=>{n.d(t,{v6:()=>i});var a=n(41482),r=n.n(a),s=n(1923);function i(e){let t=e.cookies.get(s.l)?.value;return t?function(e){try{let t=r().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{r:()=>d});var r=n(75748),s=n(74034),i=e([r,s]);async function d(e){if(!e||"undefined"===e)return null;let t=(await r.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let n=await (0,s.Z)(e),a=n.find(e=>e.isPrimary)??n[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:n.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[r,s]=i.then?(await i)():i,a()}catch(e){a(e)}})},74034:(e,t,n)=>{n.a(e,async(e,a)=>{try{n.d(t,{Z:()=>i});var r=n(75748),s=e([r]);async function i(e){return(await r.db.query(`
    SELECT
      ud.id::text,
      ud.user_id::text,
      ud.department_id::text,
      d.name AS department_name,
      ud.is_primary,
      ud.role
    FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = $1::uuid
    ORDER BY ud.is_primary DESC, d.name ASC
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}r=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),a=t.X(0,[9276,5972,1482,1585],()=>n(4833));module.exports=a})();