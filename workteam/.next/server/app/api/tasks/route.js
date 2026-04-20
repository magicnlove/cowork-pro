"use strict";(()=>{var t={};t.id=3495,t.ids=[3495],t.modules={20399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:t=>{t.exports=require("buffer")},84770:t=>{t.exports=require("crypto")},76162:t=>{t.exports=require("stream")},21764:t=>{t.exports=require("util")},8678:t=>{t.exports=import("pg")},42107:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.r(e),a.d(e,{originalPathname:()=>_,patchFetch:()=>o,requestAsyncStorage:()=>p,routeModule:()=>l,serverHooks:()=>m,staticGenerationAsyncStorage:()=>c});var i=a(49303),s=a(88716),n=a(60670),u=a(7717),d=t([u]);u=(d.then?(await d)():d)[0];let l=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/tasks/route",pathname:"/api/tasks",filename:"route",bundlePath:"app/api/tasks/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\tasks\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:p,staticGenerationAsyncStorage:c,serverHooks:m}=l,_="/api/tasks/route";function o(){return(0,n.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:c})}r()}catch(t){r(t)}})},7717:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.r(e),a.d(e,{GET:()=>E,POST:()=>S});var i=a(87070),s=a(8678),n=a(91585),u=a(20940),d=a(75748),o=a(14123),l=a(38414),p=a(27754),c=a(61165),m=a(91978),_=t([s,d,o,p,m]);[s,d,o,p,m]=_.then?(await _)():_;let N=n.Km(["backlog","in_progress","in_review","done"]),R=n.Km(["high","medium","low"]);function y(t){return null==t?[]:Array.isArray(t)?t.map(t=>String(t).trim()).filter(Boolean).map(t=>t.slice(0,40)).slice(0,20):"string"==typeof t?t.split(/[,，]/).map(t=>t.trim()).filter(Boolean).map(t=>t.slice(0,40)).slice(0,20):[]}let w=n.Ry({title:n.Z_().min(1).max(500),description:n.dj(t=>""===t||void 0===t?null:t,n.G0([n.Z_(),n.lB()]).optional()),status:N.optional(),priority:R.optional(),dueDate:n.dj(t=>""===t||void 0===t?null:t,n.G0([n.Z_(),n.lB()]).optional()),assigneeUserId:n.dj(function(t){if(""===t||null==t)return null;if("string"==typeof t){let e=t.trim();return""===e?null:e}return null},n.G0([n.Z_().uuid(),n.lB()]).optional()),tags:n.dj(t=>y(t),n.IX(n.Z_().max(40)).max(20)).optional()});function f(t){var e;return{id:t.id,title:t.title,description:t.description,status:t.status,priority:t.priority,dueDate:(e=t.due_date,null==e?null:"string"==typeof e?e.slice(0,10):e.toISOString().slice(0,10)),assigneeUserId:t.assignee_user_id,assigneeName:t.assignee_name,tags:t.tags??[],position:t.position,departmentId:t.department_id,createdBy:t.created_by,createdAt:t.created_at.toISOString(),updatedAt:t.updated_at.toISOString(),isNew:!!t.is_new}}function g(t,e,a){if(e instanceof s.DatabaseError){console.error(`[POST /api/tasks] ${t}`,{...a,message:e.message,code:e.code,detail:e.detail,constraint:e.constraint,table:e.table,column:e.column,severity:e.severity,position:e.position});return}console.error(`[POST /api/tasks] ${t}`,{...a,error:e instanceof Error?e.message:String(e),stack:e instanceof Error?e.stack:void 0})}async function E(t){let e=(0,c.v6)(t);if(!e)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,m.r)(e.sub);if(!a)return i.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let r="",s=[e.sub];if("admin"!==a.role){let t=await (0,p.J)(a);r=` WHERE (
      (t.department_id IS NOT NULL AND t.department_id = ANY($2::uuid[]))
      OR (t.department_id IS NULL AND t.created_by = $3::uuid)
    )`,s.push(t,a.id)}let n=await d.db.query(`
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.due_date::text,
      t.assignee_user_id,
      u.name AS assignee_name,
      t.tags,
      t.position,
      t.department_id::text,
      t.created_by,
      t.created_at,
      t.updated_at,
      (
        t.assignee_user_id = $1::uuid
        AND t.status <> 'done'
        AND (utr.read_at IS NULL OR t.updated_at > utr.read_at)
      ) AS is_new
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_user_id
    LEFT JOIN user_task_reads utr ON utr.task_id = t.id AND utr.user_id = $1::uuid
    ${r}
    ORDER BY t.status, t.position ASC, t.created_at ASC
    `,s);return i.NextResponse.json({tasks:n.rows.map(f)})}async function S(t){let e,a,r;let s=(0,c.v6)(t);if(!s)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});try{e=await t.json()}catch{return i.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let n=w.safeParse(e);if(!n.success)return console.error("[POST /api/tasks] validation failed",{issues:n.error.flatten(),bodyPreview:"object"==typeof e&&null!==e?JSON.stringify(e).slice(0,500):e}),i.NextResponse.json({message:"입력값이 올바르지 않습니다.",issues:n.error.flatten()},{status:400});let{title:p,description:m=null,status:_="backlog",priority:E="medium",dueDate:S=null,assigneeUserId:N=null,tags:R=[]}=n.data,T=Array.isArray(R)?R:y(R);try{let t=await d.db.query(`
      SELECT
        u.id::text AS id,
        pud.department_id::text AS department_id
      FROM users u
      LEFT JOIN LATERAL (
        SELECT ud.department_id
        FROM user_departments ud
        WHERE ud.user_id = u.id
        ORDER BY ud.is_primary DESC, ud.created_at ASC
        LIMIT 1
      ) pud ON TRUE
      WHERE u.id = $1::uuid
      LIMIT 1
      `,[s.sub]);if(0===t.rowCount)return console.error("[POST /api/tasks] created_by: no user for session.sub (JWT sub not in DB)",{sessionSub:s.sub}),i.NextResponse.json({message:"세션이 유효하지 않습니다. 다시 로그인해 주세요."},{status:401});a=t.rows[0].id,r=t.rows[0].department_id}catch(t){return g("created_by lookup failed (invalid UUID or DB error)",t,{sessionSub:s.sub}),i.NextResponse.json({message:"세션 정보를 확인할 수 없습니다. 다시 로그인해 주세요."},{status:401})}console.info("[POST /api/tasks] inserting",{titleLen:p.length,status:_,priority:E,dueDate:S,assigneeUserId:N,tagsCount:T.length,createdByUserId:a});let b=await d.db.connect();try{await b.query("BEGIN");let t=await b.query(null==r?"SELECT MAX(position)::text AS max FROM tasks WHERE status = $1 AND department_id IS NULL":"SELECT MAX(position)::text AS max FROM tasks WHERE status = $1 AND department_id = $2::uuid",null==r?[_]:[_,r]),e=null!=t.rows[0].max?Number(t.rows[0].max)+1:0,n=(await b.query(`
      INSERT INTO tasks (
        title, description, status, priority, due_date, assignee_user_id, tags, position, department_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5::date, $6::uuid, $7::text[], $8, $9::uuid, $10::uuid)
      RETURNING
        id, title, description, status, priority, due_date::text, assignee_user_id,
        tags, position, department_id::text, created_by, created_at, updated_at
      `,[p,m,_,E,S,N,T,e,r,a])).rows[0],d=await b.query("SELECT name FROM users WHERE id = $1::uuid",[n.assignee_user_id]);return await b.query("COMMIT"),console.info("[POST /api/tasks] success",{taskId:n.id}),(0,u.h0)(),N&&N!==a&&(0,l.a)(N,"task:assigned",{taskId:n.id,title:n.title}),await (0,o.v)({userId:s.sub,actionType:"task_created",entityType:"task",entityId:n.id,entityName:n.title,departmentId:n.department_id,metadata:{status:n.status,priority:n.priority,url:"/tasks"}}),i.NextResponse.json({task:f({...n,assignee_name:d.rows[0]?.name??null,is_new:!!(n.assignee_user_id===s.sub&&"done"!==n.status)})})}catch(t){try{await b.query("ROLLBACK")}catch(t){g("ROLLBACK failed after error",t)}return g("INSERT transaction failed",t,{titleLen:p.length,status:_,assigneeUserId:N,tagsSample:T.slice(0,5),createdByUserId:a}),i.NextResponse.json({message:"태스크를 저장하지 못했습니다."},{status:500})}finally{b.release()}}r()}catch(t){r(t)}})},14123:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{v:()=>d});var i=a(75748),s=a(20940),n=t([i]);async function u(t){let{userId:e,actionType:a,entityType:r,entityId:n,entityName:u,departmentId:d=null,metadata:o={}}=t,l=await i.db.query(`
    INSERT INTO activity_logs (
      user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
    RETURNING id::text
    `,[e,a,r,n,u,d,JSON.stringify(o)]);(0,s.yS)("activity:new",{id:l.rows[0]?.id??null})}async function d(t){try{await u(t)}catch(t){console.error("[activity-log]",t)}}i=(n.then?(await n)():n)[0],r()}catch(t){r(t)}})},20940:(t,e,a)=>{function r(t,e){let a=globalThis.__activityIoBroadcast;try{a?.(t,e)}catch{}}function i(){r("nav:badges",{})}function s(t){r("chat:notify",t)}a.d(e,{CK:()=>s,h0:()=>i,yS:()=>r})},1923:(t,e,a)=>{a.d(e,{S:()=>i,l:()=>r});let r="auth_token",i="password_change_required"},75748:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{db:()=>n});var i=a(8678),s=t([i]);i=(s.then?(await s)():s)[0];let n=global.__pgPool??new i.Pool({connectionString:function(){let t=process.env.DATABASE_URL;if(!t)throw Error("DATABASE_URL is not configured.");return t}()});r()}catch(t){r(t)}})},27754:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{J:()=>n,d:()=>u});var i=a(75748),s=t([i]);async function n(t){if("admin"===t.role)return[];let e=t.departments.map(t=>t.id);if("member"===t.role)return e;let a=t.departments.filter(t=>"manager"===t.role).map(t=>t.id),r=new Set(e);if(0===a.length)return[...r];for(let t of(await i.db.query(`
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
    `,[a])).rows)r.add(t.id);return[...r]}async function u(t,e){return"admin"===t.role||!!e&&(await n(t)).includes(e)}i=(s.then?(await s)():s)[0],r()}catch(t){r(t)}})},61165:(t,e,a)=>{a.d(e,{v6:()=>n});var r=a(41482),i=a.n(r),s=a(1923);function n(t){let e=t.cookies.get(s.l)?.value;return e?function(t){try{let e=i().verify(t,function(){let t=process.env.JWT_SECRET;if(!t)throw Error("JWT_SECRET is not configured.");return t}());if("object"==typeof e&&null!==e&&"sub"in e&&"email"in e)return{sub:String(e.sub),email:String(e.email)};return null}catch{return null}}(e):null}},91978:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{r:()=>u});var i=a(75748),s=a(74034),n=t([i,s]);async function u(t){if(!t||"undefined"===t)return null;let e=(await i.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[t])).rows[0];if(!e)return null;let a=await (0,s.Z)(t),r=a.find(t=>t.isPrimary)??a[0]??null;return{id:e.id,email:e.email,name:e.name,role:e.role,departmentId:r?.departmentId??null,departmentName:r?.departmentName??null,departments:a.map(t=>({id:t.departmentId,name:t.departmentName,isPrimary:t.isPrimary,role:t.role}))}}[i,s]=n.then?(await n)():n,r()}catch(t){r(t)}})},74034:(t,e,a)=>{a.a(t,async(t,r)=>{try{a.d(e,{Z:()=>n});var i=a(75748),s=t([i]);async function n(t){return(await i.db.query(`
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
    `,[t])).rows.map(t=>({id:t.id,userId:t.user_id,departmentId:t.department_id,departmentName:t.department_name,isPrimary:t.is_primary,role:t.role}))}i=(s.then?(await s)():s)[0],r()}catch(t){r(t)}})},38414:(t,e,a)=>{a.d(e,{a:()=>r});function r(t,e,a){let r=globalThis.__emitToUser;try{r?.(t,e,a)}catch{}}}};var e=require("../../../webpack-runtime.js");e.C(t);var a=t=>e(e.s=t),r=e.X(0,[9276,5972,1482,1585],()=>a(42107));module.exports=r})();