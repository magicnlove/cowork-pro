"use strict";(()=>{var t={};t.id=2940,t.ids=[2940],t.modules={20399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:t=>{t.exports=require("buffer")},84770:t=>{t.exports=require("crypto")},76162:t=>{t.exports=require("stream")},21764:t=>{t.exports=require("util")},8678:t=>{t.exports=import("pg")},13347:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.r(e),a.d(e,{originalPathname:()=>E,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>m,serverHooks:()=>c,staticGenerationAsyncStorage:()=>p});var i=a(49303),n=a(88716),d=a(60670),s=a(99544),u=t([s]);s=(u.then?(await u)():u)[0];let m=new i.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/dashboard/summary/route",pathname:"/api/dashboard/summary",filename:"route",bundlePath:"app/api/dashboard/summary/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\dashboard\\summary\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:c}=m,E="/api/dashboard/summary/route";function o(){return(0,d.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:p})}r()}catch(t){r(t)}})},99544:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.r(e),a.d(e,{GET:()=>l});var i=a(87070),n=a(75748),d=a(27754),s=a(61165),u=a(91978),o=t([n,d,u]);function m(t){return t.toISOString()}async function l(t){let e=(0,s.v6)(t);if(!e)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,u.r)(e.sub);if(!a)return i.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let r=[];"admin"!==a.role&&(r=await (0,d.J)(a));let o="admin"===a.role?await n.db.query(`
          SELECT id::text, title, due_date::text, status
          FROM tasks
          WHERE due_date = CURRENT_DATE
          ORDER BY status ASC, position ASC, created_at DESC
          LIMIT 5
          `):await n.db.query(`
          SELECT id::text, title, due_date::text, status
          FROM tasks
          WHERE due_date = CURRENT_DATE
            AND ((department_id IS NOT NULL AND department_id = ANY($1::uuid[]))
              OR (department_id IS NULL AND created_by = $2::uuid))
          ORDER BY status ASC, position ASC, created_at DESC
          LIMIT 5
          `,[r,a.id]),l=new Date;l.setUTCHours(0,0,0,0);let p=new Date(l);p.setUTCDate(p.getUTCDate()+1);let c="admin"===a.role?await n.db.query(`
          SELECT id::text, title, starts_at, kind
          FROM events
          WHERE starts_at < $2::timestamptz
            AND ends_at > $1::timestamptz
          ORDER BY starts_at ASC
          LIMIT 5
          `,[l.toISOString(),p.toISOString()]):await n.db.query(`
          SELECT id::text, title, starts_at, kind
          FROM events
          WHERE starts_at < $2::timestamptz
            AND ends_at > $1::timestamptz
            AND (
              kind = 'announcement'
              OR (kind = 'personal' AND (created_by = $3::uuid OR $3::uuid = ANY(attendee_user_ids)))
              OR (kind = 'team' AND department_id IS NOT NULL AND department_id = ANY($4::uuid[]))
            )
          ORDER BY starts_at ASC
          LIMIT 5
          `,[l.toISOString(),p.toISOString(),a.id,r]),E="admin"===a.role?await n.db.query(`
          SELECT al.id::text, u.name AS user_name, al.entity_name, al.action_type, al.created_at
          FROM activity_logs al
          INNER JOIN users u ON u.id = al.user_id
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT 5
          `):await n.db.query(`
          SELECT al.id::text, u.name AS user_name, al.entity_name, al.action_type, al.created_at
          FROM activity_logs al
          INNER JOIN users u ON u.id = al.user_id
          WHERE (al.department_id = ANY($1::uuid[]) OR (al.department_id IS NULL AND al.user_id = $2::uuid))
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT 5
          `,[r,a.id]);return i.NextResponse.json({todayTasks:o.rows.map(t=>({id:t.id,title:t.title,dueDate:t.due_date,status:t.status})),todayEvents:c.rows.map(t=>({id:t.id,title:t.title,startsAt:m(t.starts_at),kind:t.kind})),recentActivities:E.rows.map(t=>({id:t.id,userName:t.user_name,entityName:t.entity_name,actionType:t.action_type,createdAt:m(t.created_at)}))})}[n,d,u]=o.then?(await o)():o,r()}catch(t){r(t)}})},1923:(t,e,a)=>{a.d(e,{S:()=>i,l:()=>r});let r="auth_token",i="password_change_required"},75748:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{db:()=>d});var i=a(8678),n=t([i]);i=(n.then?(await n)():n)[0];let d=global.__pgPool??new i.Pool({connectionString:function(){let t=process.env.DATABASE_URL;if(!t)throw Error("DATABASE_URL is not configured.");return t}()});r()}catch(t){r(t)}})},27754:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{J:()=>d,d:()=>s});var i=a(75748),n=t([i]);async function d(t){if("admin"===t.role)return[];let e=t.departments.map(t=>t.id);if("member"===t.role)return e;let a=t.departments.filter(t=>"manager"===t.role).map(t=>t.id),r=new Set(e);if(0===a.length)return[...r];for(let t of(await i.db.query(`
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
    `,[a])).rows)r.add(t.id);return[...r]}async function s(t,e){return"admin"===t.role||!!e&&(await d(t)).includes(e)}i=(n.then?(await n)():n)[0],r()}catch(t){r(t)}})},61165:(t,e,a)=>{a.d(e,{v6:()=>d});var r=a(41482),i=a.n(r),n=a(1923);function d(t){let e=t.cookies.get(n.l)?.value;return e?function(t){try{let e=i().verify(t,function(){let t=process.env.JWT_SECRET;if(!t)throw Error("JWT_SECRET is not configured.");return t}());if("object"==typeof e&&null!==e&&"sub"in e&&"email"in e)return{sub:String(e.sub),email:String(e.email)};return null}catch{return null}}(e):null}},91978:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{r:()=>s});var i=a(75748),n=a(74034),d=t([i,n]);async function s(t){if(!t||"undefined"===t)return null;let e=(await i.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[t])).rows[0];if(!e)return null;let a=await (0,n.Z)(t),r=a.find(t=>t.isPrimary)??a[0]??null;return{id:e.id,email:e.email,name:e.name,role:e.role,departmentId:r?.departmentId??null,departmentName:r?.departmentName??null,departments:a.map(t=>({id:t.departmentId,name:t.departmentName,isPrimary:t.isPrimary,role:t.role}))}}[i,n]=d.then?(await d)():d,r()}catch(t){r(t)}})},74034:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{Z:()=>d});var i=a(75748),n=t([i]);async function d(t){return(await i.db.query(`
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
    `,[t])).rows.map(t=>({id:t.id,userId:t.user_id,departmentId:t.department_id,departmentName:t.department_name,isPrimary:t.is_primary,role:t.role}))}i=(n.then?(await n)():n)[0],r()}catch(t){r(t)}})}};var e=require("../../../../webpack-runtime.js");e.C(t);var a=t=>e(e.s=t),r=e.X(0,[9276,5972,1482],()=>a(13347));module.exports=r})();