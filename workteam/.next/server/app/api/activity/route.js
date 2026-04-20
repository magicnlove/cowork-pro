"use strict";(()=>{var e={};e.id=2504,e.ids=[2504],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},27758:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{originalPathname:()=>_,patchFetch:()=>o,requestAsyncStorage:()=>m,routeModule:()=>l,serverHooks:()=>c,staticGenerationAsyncStorage:()=>p});var n=a(49303),i=a(88716),d=a(60670),s=a(4492),u=e([s]);s=(u.then?(await u)():u)[0];let l=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/activity/route",pathname:"/api/activity",filename:"route",bundlePath:"app/api/activity/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\activity\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:m,staticGenerationAsyncStorage:p,serverHooks:c}=l,_="/api/activity/route";function o(){return(0,d.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:p})}r()}catch(e){r(e)}})},4492:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{GET:()=>c});var n=a(87070),i=a(91585),d=a(36648),s=a(75748),u=a(27754),o=a(61165),l=a(91978),m=e([d,s,u,l]);[d,s,u,l]=m.then?(await m)():m;let _=i.Ry({filter:i.Km(["all","chat","task","note","file","calendar"]).optional().default("all"),cursorCreatedAt:i.Z_().datetime().optional(),cursorId:i.Z_().uuid().optional(),limit:i.oQ.number().int().min(1).max(50).optional().default(20),q:i.Z_().max(200).optional(),dateFrom:i.Z_().optional(),dateTo:i.Z_().optional()}),y={all:[],chat:["message_sent","member_joined"],task:["task_created","task_moved","task_completed"],note:["note_created","note_updated"],file:["file_uploaded"],calendar:["event_created"]};function p(e,t){if(!e||!e.trim())return null;let a=new Date(e);if(Number.isNaN(a.getTime()))throw Error(t);return a}async function c(e){let t,a;let r=(0,o.v6)(e);if(!r)return n.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let i=await (0,l.r)(r.sub);if(!i)return n.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let m=_.safeParse({filter:e.nextUrl.searchParams.get("filter")??void 0,cursorCreatedAt:e.nextUrl.searchParams.get("cursorCreatedAt")??void 0,cursorId:e.nextUrl.searchParams.get("cursorId")??void 0,limit:e.nextUrl.searchParams.get("limit")??void 0,q:e.nextUrl.searchParams.get("q")??void 0,dateFrom:e.nextUrl.searchParams.get("dateFrom")??void 0,dateTo:e.nextUrl.searchParams.get("dateTo")??void 0});if(!m.success)return n.NextResponse.json({message:"쿼리가 올바르지 않습니다."},{status:400});let{filter:c,cursorCreatedAt:f,cursorId:h,limit:g,q:E,dateFrom:x,dateTo:v}=m.data;if(f&&!h||!f&&h)return n.NextResponse.json({message:"cursorCreatedAt, cursorId를 함께 전달해 주세요."},{status:400});try{t=p(x,"dateFrom"),a=p(v,"dateTo")}catch{return n.NextResponse.json({message:"날짜 형식이 올바르지 않습니다."},{status:400})}if(t&&a&&t.getTime()>a.getTime())return n.NextResponse.json({message:"시작일이 종료일보다 늦을 수 없습니다."},{status:400});let I=[],N=[],R=1;if("admin"!==i.role){let e=await (0,u.J)(i);I.push(`(al.department_id = ANY($${R}::uuid[]) OR (al.department_id IS NULL AND al.user_id = $${R+1}::uuid))`),N.push(e,i.id),R+=2}let S=y[c];S.length>0&&(I.push(`al.action_type = ANY($${R}::text[])`),N.push(S),R+=1);let w="string"==typeof E?E.trim():"";if(w.length>0){let e=`%${w}%`;I.push(`(u.name ILIKE $${R} OR al.entity_name ILIKE $${R+1} OR al.action_type::text ILIKE $${R+2})`),N.push(e,e,e),R+=3}t&&(I.push(`al.created_at >= $${R}::timestamptz`),N.push(t.toISOString()),R+=1),a&&(I.push(`al.created_at <= $${R}::timestamptz`),N.push(a.toISOString()),R+=1),f&&h&&(I.push(`(al.created_at, al.id) < ($${R}::timestamptz, $${R+1}::uuid)`),N.push(f,h),R+=2);let A=I.length>0?`WHERE ${I.join(" AND ")}`:"",T=await s.db.query(`
    SELECT
      al.id::text,
      al.user_id::text,
      u.name AS user_name,
      u.email AS user_email,
      al.action_type,
      al.entity_type,
      al.entity_id::text,
      al.entity_name,
      al.department_id::text,
      d.name AS department_name,
      al.metadata,
      al.created_at
    FROM activity_logs al
    INNER JOIN users u ON u.id = al.user_id
    LEFT JOIN departments d ON d.id = al.department_id
    ${A}
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT $${R}
    `,[...N,g+1]),$=T.rows.length>g,O=T.rows.slice(0,g).map(e=>{let t=e.metadata??{},a=(0,d.G)(i,e.user_id);return{id:e.id,userId:e.user_id,userName:e.user_name,userEmail:e.user_email,actionType:e.action_type,entityType:e.entity_type,entityId:e.entity_id,entityName:e.entity_name,departmentId:e.department_id,departmentName:e.department_name,metadata:t,createdAt:e.created_at.toISOString(),link:function(e,t,a){let r=a.url;return"string"==typeof r&&r.trim()?r:"task"===e?"/tasks":"note"===e?`/meeting-notes?id=${encodeURIComponent(t)}`:"event"===e?"/calendar":"channel"===e?"/chat":"/activity-feed"}(e.entity_type,e.entity_id,t),canDelete:!!a||void 0}}),C=O[O.length-1];return n.NextResponse.json({items:O,nextCursor:$&&C?{cursorCreatedAt:C.createdAt,cursorId:C.id}:null})}r()}catch(e){r(e)}})},36648:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{G:()=>s,e:()=>d});var n=a(27754),i=e([n]);async function d(e,t){if("admin"===e.role)return!0;let a=await (0,n.J)(e);return!!(t.department_id&&a.includes(t.department_id))||!t.department_id&&t.user_id===e.id}function s(e,t){return"admin"===e.role||e.id===t}n=(i.then?(await i)():i)[0],r()}catch(e){r(e)}})},1923:(e,t,a)=>{a.d(t,{S:()=>n,l:()=>r});let r="auth_token",n="password_change_required"},75748:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{db:()=>d});var n=a(8678),i=e([n]);n=(i.then?(await i)():i)[0];let d=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});r()}catch(e){r(e)}})},27754:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{J:()=>d,d:()=>s});var n=a(75748),i=e([n]);async function d(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let a=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),r=new Set(t);if(0===a.length)return[...r];for(let e of(await n.db.query(`
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
    `,[a])).rows)r.add(e.id);return[...r]}async function s(e,t){return"admin"===e.role||!!t&&(await d(e)).includes(t)}n=(i.then?(await i)():i)[0],r()}catch(e){r(e)}})},61165:(e,t,a)=>{a.d(t,{v6:()=>d});var r=a(41482),n=a.n(r),i=a(1923);function d(e){let t=e.cookies.get(i.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{r:()=>s});var n=a(75748),i=a(74034),d=e([n,i]);async function s(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let a=await (0,i.Z)(e),r=a.find(e=>e.isPrimary)??a[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:r?.departmentId??null,departmentName:r?.departmentName??null,departments:a.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,i]=d.then?(await d)():d,r()}catch(e){r(e)}})},74034:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.d(t,{Z:()=>d});var n=a(75748),i=e([n]);async function d(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(i.then?(await i)():i)[0],r()}catch(e){r(e)}})}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[9276,5972,1482,1585],()=>a(27758));module.exports=r})();