"use strict";(()=>{var e={};e.id=6007,e.ids=[6007],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},8805:(e,t,s)=>{s.a(e,async(e,a)=>{try{s.r(t),s.d(t,{originalPathname:()=>_,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>p,serverHooks:()=>c,staticGenerationAsyncStorage:()=>m});var n=s(49303),r=s(88716),i=s(60670),d=s(83166),u=e([d]);d=(u.then?(await u)():u)[0];let p=new n.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/events/[id]/route",pathname:"/api/events/[id]",filename:"route",bundlePath:"app/api/events/[id]/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\events\\[id]\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:c}=p,_="/api/events/[id]/route";function o(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:m})}a()}catch(e){a(e)}})},83166:(e,t,s)=>{s.a(e,async(e,a)=>{try{s.r(t),s.d(t,{DELETE:()=>y,GET:()=>f,PATCH:()=>E});var n=s(87070),r=s(8678),i=s(91585),d=s(75748),u=s(84124),o=s(27754),p=s(61165),l=s(91978),m=e([r,d,u,o,l]);[r,d,u,o,l]=m.then?(await m)():m;let R=i.Km(["personal","team","announcement"]),g=i.Z_().min(1).refine(e=>!Number.isNaN(Date.parse(e)),{message:"유효한 날짜\xb7시간 형식이 아닙니다."}),x=i.Ry({title:i.Z_().min(1).max(500).optional(),description:i.Z_().nullable().optional(),startsAt:g.optional(),endsAt:g.optional(),kind:R.optional(),departmentId:i.Z_().uuid().nullable().optional(),attendeeUserIds:i.dj(function(e){return null==e||""===e?[]:Array.isArray(e)?e.map(e=>"string"==typeof e?e.trim():"").filter(Boolean):[]},i.IX(i.Z_().uuid()).max(50)).optional()}).strict();async function c(e){return 0===e.length?[]:(await d.db.query("SELECT id::text, name, email FROM users WHERE id = ANY($1::uuid[])",[e])).rows}function _(e,t){return{id:e.id,title:e.title,description:e.description,startsAt:e.starts_at.toISOString(),endsAt:e.ends_at.toISOString(),kind:e.kind,departmentId:e.department_id,attendeeUserIds:e.attendee_user_ids??[],attendees:t,createdBy:e.created_by,createdAt:e.created_at.toISOString(),updatedAt:e.updated_at.toISOString()}}async function f(e,t){let s=(0,p.v6)(e);if(!s)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,l.r)(s.sub);if(!a)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:r}=t.params,i=(await d.db.query(`
    SELECT
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
    FROM events WHERE id = $1::uuid
    `,[r])).rows[0];if(!i)return n.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,u.o)(a,{kind:i.kind,department_id:i.department_id,created_by:i.created_by,attendee_user_ids:i.attendee_user_ids??[]}))return n.NextResponse.json({message:"접근 권한이 없습니다."},{status:403});let o=await c(i.attendee_user_ids??[]);return n.NextResponse.json({event:_(i,o)})}async function E(e,t){let s;let a=(0,p.v6)(e);if(!a)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let i=await (0,l.r)(a.sub);if(!i)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:m}=t.params,f=(await d.db.query(`
    SELECT
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
    FROM events WHERE id = $1::uuid
    `,[m])).rows[0];if(!f)return n.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,u.o)(i,{kind:f.kind,department_id:f.department_id,created_by:f.created_by,attendee_user_ids:f.attendee_user_ids??[]}))return n.NextResponse.json({message:"접근 권한이 없습니다."},{status:403});if(!(0,u.a)(i,f.created_by))return n.NextResponse.json({message:"수정 권한이 없습니다."},{status:403});try{s=await e.json()}catch{return n.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let E=x.safeParse(s);if(!E.success)return n.NextResponse.json({message:"입력값이 올바르지 않습니다.",issues:E.error.flatten()},{status:400});let y=E.data,R=[],g=[],h=1;if(void 0!==y.title&&(R.push(`title = $${h++}`),g.push(y.title)),void 0!==y.description&&(R.push(`description = $${h++}`),g.push(y.description)),void 0!==y.startsAt&&(R.push(`starts_at = $${h++}::timestamptz`),g.push(y.startsAt)),void 0!==y.endsAt&&(R.push(`ends_at = $${h++}::timestamptz`),g.push(y.endsAt)),void 0!==y.kind&&(R.push(`kind = $${h++}`),g.push(y.kind)),void 0!==y.departmentId){let e=y.kind??f.kind;if("team"===e){if(!y.departmentId)return n.NextResponse.json({message:"팀 일정에는 부서가 필요합니다."},{status:400});if(!await (0,o.d)(i,y.departmentId))return n.NextResponse.json({message:"선택한 부서에 일정을 둘 권한이 없습니다."},{status:403})}R.push(`department_id = $${h++}::uuid`),g.push("team"===e?y.departmentId:null)}else void 0!==y.kind&&"team"!==y.kind&&(R.push(`department_id = $${h++}`),g.push(null));if(void 0!==y.attendeeUserIds){let e=0===y.attendeeUserIds.length?null:y.attendeeUserIds;R.push(`attendee_user_ids = COALESCE($${h++}::uuid[], ARRAY[]::uuid[])`),g.push(e)}if(0===R.length)return n.NextResponse.json({message:"변경할 내용이 없습니다."},{status:400});R.push("updated_at = NOW()"),g.push(m);try{await d.db.query(`UPDATE events SET ${R.join(", ")} WHERE id = $${h}::uuid`,g)}catch(e){return function(e,t,s){if(t instanceof r.DatabaseError){console.error(`[PATCH /api/events] ${e}`,{...s,message:t.message,code:t.code,detail:t.detail,constraint:t.constraint,table:t.table,column:t.column,severity:t.severity,position:t.position});return}console.error(`[PATCH /api/events] ${e}`,{...s,error:t instanceof Error?t.message:String(t),stack:t instanceof Error?t.stack:void 0})}("UPDATE failed",e,{eventId:m}),n.NextResponse.json({message:"일정을 수정하지 못했습니다."},{status:500})}let v=(await d.db.query(`
    SELECT
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
    FROM events WHERE id = $1::uuid
    `,[m])).rows[0];if(!v)return n.NextResponse.json({message:"찾을 수 없습니다."},{status:404});let N=v.starts_at.getTime();if(v.ends_at.getTime()<=N)return n.NextResponse.json({message:"종료 시간이 시작 시간보다 늦어야 합니다."},{status:400});let b=await c(v.attendee_user_ids??[]);return n.NextResponse.json({event:_(v,b)})}async function y(e,t){let s=(0,p.v6)(e);if(!s)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,l.r)(s.sub);if(!a)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:r}=t.params,i=(await d.db.query(`
    SELECT kind, department_id::text, created_by, attendee_user_ids
    FROM events WHERE id = $1::uuid
    `,[r])).rows[0];if(!i)return n.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,u.o)(a,{kind:i.kind,department_id:i.department_id,created_by:i.created_by,attendee_user_ids:i.attendee_user_ids??[]}))return n.NextResponse.json({message:"접근 권한이 없습니다."},{status:403});if(!(0,u.a)(a,i.created_by))return n.NextResponse.json({message:"삭제 권한이 없습니다."},{status:403});let o=await d.db.query("DELETE FROM events WHERE id = $1::uuid RETURNING id",[r]);return 0===o.rowCount?n.NextResponse.json({message:"찾을 수 없습니다."},{status:404}):n.NextResponse.json({ok:!0})}a()}catch(e){a(e)}})},1923:(e,t,s)=>{s.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,s)=>{s.a(e,async(e,a)=>{try{s.d(t,{db:()=>i});var n=s(8678),r=e([n]);n=(r.then?(await r)():r)[0];let i=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},84124:(e,t,s)=>{s.a(e,async(e,a)=>{try{s.d(t,{a:()=>d,o:()=>i});var n=s(27754),r=e([n]);async function i(e,t){return"announcement"===t.kind||("personal"===t.kind?t.created_by===e.id||(t.attendee_user_ids??[]).includes(e.id):"team"===t.kind&&(t.department_id?"admin"===e.role||(await (0,n.J)(e)).includes(t.department_id):"admin"===e.role))}function d(e,t){return"admin"===e.role||null!=t&&t===e.id}n=(r.then?(await r)():r)[0],a()}catch(e){a(e)}})},27754:(e,t,s)=>{s.a(e,async(e,a)=>{try{s.d(t,{J:()=>i,d:()=>d});var n=s(75748),r=e([n]);async function i(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let s=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),a=new Set(t);if(0===s.length)return[...a];for(let e of(await n.db.query(`
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
    `,[s])).rows)a.add(e.id);return[...a]}async function d(e,t){return"admin"===e.role||!!t&&(await i(e)).includes(t)}n=(r.then?(await r)():r)[0],a()}catch(e){a(e)}})},61165:(e,t,s)=>{s.d(t,{v6:()=>i});var a=s(41482),n=s.n(a),r=s(1923);function i(e){let t=e.cookies.get(r.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,s)=>{s.a(e,async(e,a)=>{try{s.d(t,{r:()=>d});var n=s(75748),r=s(74034),i=e([n,r]);async function d(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let s=await (0,r.Z)(e),a=s.find(e=>e.isPrimary)??s[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:s.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,r]=i.then?(await i)():i,a()}catch(e){a(e)}})},74034:(e,t,s)=>{s.a(e,async(e,a)=>{try{s.d(t,{Z:()=>i});var n=s(75748),r=e([n]);async function i(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(r.then?(await r)():r)[0],a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var s=e=>t(t.s=e),a=t.X(0,[9276,5972,1482,1585],()=>s(8805));module.exports=a})();