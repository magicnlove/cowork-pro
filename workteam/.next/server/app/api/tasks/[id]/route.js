"use strict";(()=>{var t={};t.id=1974,t.ids=[1974],t.modules={20399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:t=>{t.exports=require("buffer")},84770:t=>{t.exports=require("crypto")},20629:t=>{t.exports=require("fs/promises")},55315:t=>{t.exports=require("path")},76162:t=>{t.exports=require("stream")},21764:t=>{t.exports=require("util")},8678:t=>{t.exports=import("pg")},43164:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.r(e),a.d(e,{originalPathname:()=>y,patchFetch:()=>o,requestAsyncStorage:()=>l,routeModule:()=>p,serverHooks:()=>m,staticGenerationAsyncStorage:()=>c});var s=a(49303),r=a(88716),n=a(60670),d=a(96628),u=t([d]);d=(u.then?(await u)():u)[0];let p=new s.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/tasks/[id]/route",pathname:"/api/tasks/[id]",filename:"route",bundlePath:"app/api/tasks/[id]/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\tasks\\[id]\\route.ts",nextConfigOutput:"",userland:d}),{requestAsyncStorage:l,staticGenerationAsyncStorage:c,serverHooks:m}=p,y="/api/tasks/[id]/route";function o(){return(0,n.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:c})}i()}catch(t){i(t)}})},96628:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.r(e),a.d(e,{DELETE:()=>N,GET:()=>R,PATCH:()=>w});var s=a(87070),r=a(91585),n=a(20940),d=a(75748),u=a(14123),o=a(38414),p=a(37014),l=a(95698),c=a(45043),m=a(20355),y=a(61165),_=a(91978),E=t([d,u,p,c,_]);[d,u,p,c,_]=E.then?(await E)():E;let h=r.Km(["backlog","in_progress","in_review","done"]),x=r.Km(["high","medium","low"]),S=r.Ry({title:r.Z_().min(1).max(500).optional(),description:r.Z_().nullable().optional(),status:h.optional(),priority:x.optional(),dueDate:r.Z_().nullable().optional(),assigneeUserId:r.Z_().uuid().nullable().optional(),tags:r.IX(r.Z_().max(40)).max(20).optional(),moveTo:r.Ry({status:h,index:r.Rx().int().min(0)}).optional()}).strict();function g(t){var e;return{id:t.id,title:t.title,description:t.description,status:t.status,priority:t.priority,dueDate:(e=t.due_date,null==e?null:"string"==typeof e?e.slice(0,10):e.toISOString().slice(0,10)),assigneeUserId:t.assignee_user_id,assigneeName:t.assignee_name,tags:t.tags??[],position:t.position,departmentId:t.department_id,createdBy:t.created_by,createdAt:t.created_at.toISOString(),updatedAt:t.updated_at.toISOString(),isNew:!!t.is_new}}async function f(t,e){return(await d.db.query(`
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
        t.assignee_user_id = $2::uuid
        AND t.status <> 'done'
        AND (utr.read_at IS NULL OR t.updated_at > utr.read_at)
      ) AS is_new
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_user_id
    LEFT JOIN user_task_reads utr ON utr.task_id = t.id AND utr.user_id = $2::uuid
    WHERE t.id = $1
    `,[t,e])).rows[0]??null}async function R(t,e){let a=(0,y.v6)(t);if(!a)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let i=await (0,_.r)(a.sub);if(!i)return s.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:r}=e.params,n=await f(r,a.sub);return n?await (0,c.c)(i,{departmentId:n.department_id,createdBy:n.created_by})?s.NextResponse.json({task:g(n)}):s.NextResponse.json({message:"접근 권한이 없습니다."},{status:403}):s.NextResponse.json({message:"찾을 수 없습니다."},{status:404})}async function w(t,e){let a;let i=(0,y.v6)(t);if(!i)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=await (0,_.r)(i.sub);if(!r)return s.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:p}=e.params,l=await f(p,i.sub);if(!l)return s.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,c.c)(r,{departmentId:l.department_id,createdBy:l.created_by}))return s.NextResponse.json({message:"접근 권한이 없습니다."},{status:403});try{a=await t.json()}catch{return s.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let E=S.safeParse(a);if(!E.success)return s.NextResponse.json({message:"입력값이 올바르지 않습니다.",issues:E.error.flatten()},{status:400});let R=E.data,w=await d.db.connect();try{await w.query("BEGIN");let t=!1;if(R.moveTo&&(await (0,m.b)(w,p,R.moveTo.status,R.moveTo.index),t=!0),void 0!==R.status&&!R.moveTo){let e=await w.query("SELECT status FROM tasks WHERE id = $1 FOR UPDATE",[p]);if(0===e.rowCount)return await w.query("ROLLBACK"),s.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(e.rows[0].status!==R.status){let e=await w.query(null==l.department_id?"SELECT COUNT(*)::text AS c FROM tasks WHERE status = $1 AND id <> $2 AND department_id IS NULL":"SELECT COUNT(*)::text AS c FROM tasks WHERE status = $1 AND id <> $2 AND department_id = $3::uuid",null==l.department_id?[R.status,p]:[R.status,p,l.department_id]),a=Number(e.rows[0].c);await (0,m.b)(w,p,R.status,a),t=!0}}let e=[],a=[],i=1;if(void 0!==R.title&&(e.push(`title = $${i++}`),a.push(R.title)),void 0!==R.description&&(e.push(`description = $${i++}`),a.push(R.description)),void 0!==R.priority&&(e.push(`priority = $${i++}`),a.push(R.priority)),void 0!==R.dueDate&&(e.push(`due_date = $${i++}::date`),a.push(R.dueDate)),void 0!==R.assigneeUserId&&(e.push(`assignee_user_id = $${i++}::uuid`),a.push(R.assigneeUserId)),void 0!==R.tags&&(e.push(`tags = $${i++}::text[]`),a.push(R.tags)),e.length>0&&(e.push("updated_at = NOW()"),a.push(p),await w.query(`UPDATE tasks SET ${e.join(", ")} WHERE id = $${i}::uuid`,a),t=!0),!t)return await w.query("ROLLBACK"),s.NextResponse.json({message:"변경할 내용이 없습니다."},{status:400});await w.query("COMMIT")}catch(t){if(await w.query("ROLLBACK"),t instanceof Error&&"NOT_FOUND"===t.message)return s.NextResponse.json({message:"찾을 수 없습니다."},{status:404});return console.error(t),s.NextResponse.json({message:"저장하지 못했습니다."},{status:500})}finally{w.release()}let N=await f(p,i.sub);if(!N)return s.NextResponse.json({message:"찾을 수 없습니다."},{status:404});(0,n.h0)(),void 0!==R.assigneeUserId&&N.assignee_user_id&&N.assignee_user_id!==l.assignee_user_id&&N.assignee_user_id!==i.sub&&(0,o.a)(N.assignee_user_id,"task:assigned",{taskId:N.id,title:N.title});let h=l.status,x=N.status;return(x!==h||R.moveTo)&&await (0,u.v)({userId:i.sub,actionType:"done"===x&&"done"!==h?"task_completed":"task_moved",entityType:"task",entityId:N.id,entityName:N.title,departmentId:N.department_id,metadata:{fromStatus:h,toStatus:x,url:"/tasks"}}),s.NextResponse.json({task:g(N)})}async function N(t,e){let a=(0,y.v6)(t);if(!a)return s.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let i=await (0,_.r)(a.sub);if(!i)return s.NextResponse.json({message:"사용자를 찾을 수 없습니다."},{status:401});let{id:r}=e.params,n=await f(r,a.sub);if(!n)return s.NextResponse.json({message:"찾을 수 없습니다."},{status:404});if(!await (0,c.c)(i,{departmentId:n.department_id,createdBy:n.created_by}))return s.NextResponse.json({message:"접근 권한이 없습니다."},{status:403});for(let t of(await (0,p.fA)("task",r)))await (0,l.Yy)(t.storage_key);let u=await d.db.query("DELETE FROM tasks WHERE id = $1 RETURNING id",[r]);return 0===u.rowCount?s.NextResponse.json({message:"찾을 수 없습니다."},{status:404}):s.NextResponse.json({ok:!0})}i()}catch(t){i(t)}})},14123:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{v:()=>u});var s=a(75748),r=a(20940),n=t([s]);async function d(t){let{userId:e,actionType:a,entityType:i,entityId:n,entityName:d,departmentId:u=null,metadata:o={}}=t,p=await s.db.query(`
    INSERT INTO activity_logs (
      user_id, action_type, entity_type, entity_id, entity_name, department_id, metadata
    )
    VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::uuid, $7::jsonb)
    RETURNING id::text
    `,[e,a,i,n,d,u,JSON.stringify(o)]);(0,r.yS)("activity:new",{id:p.rows[0]?.id??null})}async function u(t){try{await d(t)}catch(t){console.error("[activity-log]",t)}}s=(n.then?(await n)():n)[0],i()}catch(t){i(t)}})},20940:(t,e,a)=>{function i(t,e){let a=globalThis.__activityIoBroadcast;try{a?.(t,e)}catch{}}function s(){i("nav:badges",{})}function r(t){i("chat:notify",t)}a.d(e,{CK:()=>r,h0:()=>s,yS:()=>i})},1923:(t,e,a)=>{a.d(e,{S:()=>s,l:()=>i});let i="auth_token",s="password_change_required"},75748:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{db:()=>n});var s=a(8678),r=t([s]);s=(r.then?(await r)():r)[0];let n=global.__pgPool??new s.Pool({connectionString:function(){let t=process.env.DATABASE_URL;if(!t)throw Error("DATABASE_URL is not configured.");return t}()});i()}catch(t){i(t)}})},37014:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{Gd:()=>d,Gf:()=>l,cB:()=>c,ev:()=>u,fA:()=>m,yg:()=>o,zx:()=>p});var s=a(75748),r=a(65465),n=t([s,r]);function d(t){let e=t.mime_type.startsWith("image/"),a=(0,r.K5)(t);return{id:t.id,originalName:t.original_name,mimeType:t.mime_type,byteSize:Number(t.byte_size),url:`/api/files/${t.id}`,previewUrl:e&&!a?`/api/files/${t.id}?inline=1`:null,isImage:e,expired:!!a||void 0}}async function u(t,e){return(await s.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    ORDER BY created_at ASC
    `,[t,e])).rows.map(d)}async function o(t){let e=new Map;if(0===t.length)return e;for(let a of(await s.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = 'chat_message' AND entity_id = ANY($1::uuid[])
    ORDER BY created_at ASC
    `,[t])).rows){let t=a.entity_id,i=d(a),s=e.get(t)??[];s.push(i),e.set(t,s)}return e}async function p(t){return(await s.db.query(`
    INSERT INTO file_attachments (
      entity_type, entity_id, uploaded_by, original_name, storage_key, mime_type, byte_size
    )
    VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7)
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[t.entityType,t.entityId,t.uploadedBy,t.originalName,t.storageKey,t.mimeType,t.byteSize])).rows[0]}async function l(t){return(await s.db.query(`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE id = $1::uuid
    LIMIT 1
    `,[t])).rows[0]??null}async function c(t){return(await s.db.query(`
    DELETE FROM file_attachments
    WHERE id = $1::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[t])).rows[0]??null}async function m(t,e){return(await s.db.query(`
    DELETE FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,[t,e])).rows}[s,r]=n.then?(await n)():n,i()}catch(t){i(t)}})},65465:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{Hw:()=>o,K5:()=>u});var s=a(75748),r=a(95698),n=t([s]);function d(){let t=Number(process.env.RETENTION_FILES_DAYS);return Number.isFinite(t)&&t>0?t:30}function u(t){var e;if(e=t.entity_type,"chat_message"!==e&&"task"!==e)return!1;let a=d(),i=new Date(t.created_at);return i.setDate(i.getDate()+a),Date.now()>i.getTime()}async function o(){let t=d(),e=await s.db.connect(),a=0,i=[];try{await e.query("BEGIN");let s=await e.query(`
      SELECT id::text, storage_key
      FROM file_attachments
      WHERE entity_type IN ('chat_message', 'task')
        AND created_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,[t]);if(0===s.rows.length)return await e.query("INSERT INTO cleanup_logs (files_deleted) VALUES (0)"),await e.query("COMMIT"),{filesDeleted:0};let r=s.rows.map(t=>t.id),n=await e.query(`
      DELETE FROM file_attachments
      WHERE id = ANY($1::uuid[])
      RETURNING storage_key
      `,[r]);for(let t of(a=n.rows.length,n.rows))i.push(t.storage_key);await e.query("INSERT INTO cleanup_logs (files_deleted) VALUES ($1)",[a]),await e.query("COMMIT")}catch(t){try{await e.query("ROLLBACK")}catch{}throw t}finally{e.release()}return await Promise.all(i.map(t=>(0,r.Yy)(t))),{filesDeleted:a}}s=(n.then?(await n)():n)[0],i()}catch(t){i(t)}})},95698:(t,e,a)=>{a.d(e,{D0:()=>c,Yy:()=>m,fu:()=>y,q5:()=>l});var i=a(84770),s=a(20629),r=a.n(s),n=a(55315),d=a.n(n);let u=d().join(process.cwd(),"storage","uploads"),o=new Set(["pdf","docx","xlsx","pptx","jpg","jpeg","png","zip"]),p={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",zip:"application/zip"};function l(t){let e=d().basename(t),a=e.lastIndexOf(".");return -1===a?"":e.slice(a+1).toLowerCase()}async function c(t,e){let a=l(e);if(!a||!o.has(a))throw Error("unsupported_type");if(t.length>26214400)throw Error("too_large");let s=p[a.toLowerCase()]??"application/octet-stream",n=new Date,c=d().join(String(n.getFullYear()),String(n.getMonth()+1).padStart(2,"0")),m=d().join(u,c);await r().mkdir(m,{recursive:!0});let y=d().basename(e).replace(/[^a-zA-Z0-9._-가-힣]/g,"_").slice(0,200),_=`${(0,i.randomUUID)()}_${y||`file.${a}`}`,E=d().join(m,_);return await r().writeFile(E,t),{storageKey:d().join(c,_).replace(/\\/g,"/"),mimeType:s,byteSize:t.length}}async function m(t){let e=d().join(u,t),a=d().normalize(e);if(!a.startsWith(d().normalize(u)))throw Error("invalid_path");await r().unlink(a).catch(()=>void 0)}function y(t){return d().join(u,t)}},27754:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{J:()=>n,d:()=>d});var s=a(75748),r=t([s]);async function n(t){if("admin"===t.role)return[];let e=t.departments.map(t=>t.id);if("member"===t.role)return e;let a=t.departments.filter(t=>"manager"===t.role).map(t=>t.id),i=new Set(e);if(0===a.length)return[...i];for(let t of(await s.db.query(`
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
    `,[a])).rows)i.add(t.id);return[...i]}async function d(t,e){return"admin"===t.role||!!e&&(await n(t)).includes(e)}s=(r.then?(await r)():r)[0],i()}catch(t){i(t)}})},61165:(t,e,a)=>{a.d(e,{v6:()=>n});var i=a(41482),s=a.n(i),r=a(1923);function n(t){let e=t.cookies.get(r.l)?.value;return e?function(t){try{let e=s().verify(t,function(){let t=process.env.JWT_SECRET;if(!t)throw Error("JWT_SECRET is not configured.");return t}());if("object"==typeof e&&null!==e&&"sub"in e&&"email"in e)return{sub:String(e.sub),email:String(e.email)};return null}catch{return null}}(e):null}},45043:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{c:()=>n});var s=a(27754),r=t([s]);async function n(t,e){return"admin"===t.role||(e.departmentId?(await (0,s.J)(t)).includes(e.departmentId):e.createdBy===t.id)}s=(r.then?(await r)():r)[0],i()}catch(t){i(t)}})},20355:(t,e,a)=>{a.d(e,{b:()=>i});async function i(t,e,a,i){let s=await t.query("SELECT status, department_id::text FROM tasks WHERE id = $1 FOR UPDATE",[e]);if(0===s.rowCount)throw Error("NOT_FOUND");let r=s.rows[0].status,n=s.rows[0].department_id,d=t=>null===n?[t]:[t,n];if(r===a){let{rows:a}=await t.query(null===n?"SELECT id FROM tasks WHERE status = $1 AND department_id IS NULL ORDER BY position ASC, created_at ASC":"SELECT id FROM tasks WHERE status = $1 AND department_id = $2::uuid ORDER BY position ASC, created_at ASC",d(r)),s=a.map(t=>t.id),u=s.indexOf(e);if(-1===u)return;s.splice(u,1);let o=Math.max(0,Math.min(i,s.length));s.splice(o,0,e);for(let e=0;e<s.length;e++)await t.query("UPDATE tasks SET position = $1, updated_at = NOW() WHERE id = $2",[e,s[e]]);return}let{rows:u}=await t.query(null===n?"SELECT id FROM tasks WHERE status = $1 AND department_id IS NULL ORDER BY position ASC, created_at ASC":"SELECT id FROM tasks WHERE status = $1 AND department_id = $2::uuid ORDER BY position ASC, created_at ASC",d(r)),o=u.map(t=>t.id).filter(t=>t!==e);for(let e=0;e<o.length;e++)await t.query("UPDATE tasks SET position = $1, updated_at = NOW() WHERE id = $2",[e,o[e]]);let{rows:p}=await t.query(null===n?"SELECT id FROM tasks WHERE status = $1 AND department_id IS NULL ORDER BY position ASC, created_at ASC":"SELECT id FROM tasks WHERE status = $1 AND department_id = $2::uuid ORDER BY position ASC, created_at ASC",d(a)),l=p.map(t=>t.id),c=Math.max(0,Math.min(i,l.length));l.splice(c,0,e);for(let e=0;e<l.length;e++)await t.query("UPDATE tasks SET status = $1, position = $2, updated_at = NOW() WHERE id = $3",[a,e,l[e]])}},91978:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{r:()=>d});var s=a(75748),r=a(74034),n=t([s,r]);async function d(t){if(!t||"undefined"===t)return null;let e=(await s.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[t])).rows[0];if(!e)return null;let a=await (0,r.Z)(t),i=a.find(t=>t.isPrimary)??a[0]??null;return{id:e.id,email:e.email,name:e.name,role:e.role,departmentId:i?.departmentId??null,departmentName:i?.departmentName??null,departments:a.map(t=>({id:t.departmentId,name:t.departmentName,isPrimary:t.isPrimary,role:t.role}))}}[s,r]=n.then?(await n)():n,i()}catch(t){i(t)}})},74034:(t,e,a)=>{a.a(t,async(t,i)=>{try{a.d(e,{Z:()=>n});var s=a(75748),r=t([s]);async function n(t){return(await s.db.query(`
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
    `,[t])).rows.map(t=>({id:t.id,userId:t.user_id,departmentId:t.department_id,departmentName:t.department_name,isPrimary:t.is_primary,role:t.role}))}s=(r.then?(await r)():r)[0],i()}catch(t){i(t)}})},38414:(t,e,a)=>{a.d(e,{a:()=>i});function i(t,e,a){let i=globalThis.__emitToUser;try{i?.(t,e,a)}catch{}}}};var e=require("../../../../webpack-runtime.js");e.C(t);var a=t=>e(e.s=t),i=e.X(0,[9276,5972,1482,1585],()=>a(43164));module.exports=i})();