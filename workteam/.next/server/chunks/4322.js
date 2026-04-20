"use strict";exports.id=4322,exports.ids=[4322],exports.modules={23016:(e,t,a)=>{a.d(t,{F:()=>i});let i=`
(
  (c.kind = 'dm' AND $1::uuid IN (c.dm_user_a_id, c.dm_user_b_id))
  OR (c.kind = 'company_wide')
  OR (
    c.kind = 'department'
    AND (
      EXISTS (
        SELECT 1
        FROM user_departments ud
        WHERE ud.user_id = $1::uuid
          AND ud.department_id = c.department_id
      )
      OR EXISTS (
        WITH RECURSIVE managed AS (
          SELECT ud.department_id AS id
          FROM user_departments ud
          INNER JOIN users ux ON ux.id = ud.user_id
          WHERE ud.user_id = $1::uuid
            AND ud.role = 'manager'
            AND ux.role = 'manager'
          UNION ALL
          SELECT d.id
          FROM departments d
          INNER JOIN managed m ON d.parent_id = m.id
        )
        SELECT 1 FROM managed WHERE id = c.department_id
      )
    )
  )
  OR (
    c.kind IN ('cross_team', 'group_dm')
    AND (
      EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.channel_id = c.id AND cm.user_id = $1::uuid
      )
      OR c.created_by = $1::uuid
    )
  )
)
`},1923:(e,t,a)=>{a.d(t,{S:()=>n,l:()=>i});let i="auth_token",n="password_change_required"},75748:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{db:()=>d});var n=a(8678),r=e([n]);n=(r.then?(await r)():r)[0];let d=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});i()}catch(e){i(e)}})},37014:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Gd:()=>u,Gf:()=>c,cB:()=>m,ev:()=>s,fA:()=>y,yg:()=>o,zx:()=>l});var n=a(75748),r=a(65465),d=e([n,r]);function u(e){let t=e.mime_type.startsWith("image/"),a=(0,r.K5)(e);return{id:e.id,originalName:e.original_name,mimeType:e.mime_type,byteSize:Number(e.byte_size),url:`/api/files/${e.id}`,previewUrl:t&&!a?`/api/files/${e.id}?inline=1`:null,isImage:t,expired:!!a||void 0}}async function s(e,t){return(await n.db.query(`
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
    `,[e,t])).rows.map(u)}async function o(e){let t=new Map;if(0===e.length)return t;for(let a of(await n.db.query(`
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
    `,[e])).rows){let e=a.entity_id,i=u(a),n=t.get(e)??[];n.push(i),t.set(e,n)}return t}async function l(e){return(await n.db.query(`
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
    `,[e.entityType,e.entityId,e.uploadedBy,e.originalName,e.storageKey,e.mimeType,e.byteSize])).rows[0]}async function c(e){return(await n.db.query(`
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
    `,[e])).rows[0]??null}async function m(e){return(await n.db.query(`
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
    `,[e])).rows[0]??null}async function y(e,t){return(await n.db.query(`
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
    `,[e,t])).rows}[n,r]=d.then?(await d)():d,i()}catch(e){i(e)}})},85622:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Ci:()=>m,fg:()=>l,t4:()=>c});var n=a(75748),r=a(23016),d=a(45043),u=a(49185),s=a(91978),o=e([n,d,u,s]);async function l(e,t){let a=await (0,s.r)(e);if(!a)return!1;if("admin"===a.role)return!0;if("chat_message"===t.entity_type){let a=await n.db.query(`
      SELECT TRUE AS ok
      FROM file_attachments fa
      INNER JOIN messages m ON m.id = fa.entity_id AND fa.entity_type = 'chat_message'
      INNER JOIN channels c ON c.id = m.channel_id
      INNER JOIN users u ON u.id = $1::uuid
      WHERE fa.id = $2::uuid AND ${r.F}
      LIMIT 1
      `,[e,t.id]);return!!a.rows[0]?.ok}if("task"===t.entity_type){let e=(await n.db.query("SELECT department_id::text, created_by::text FROM tasks WHERE id = $1::uuid",[t.entity_id])).rows[0];return!!e&&(0,d.c)(a,{departmentId:e.department_id,createdBy:e.created_by})}if("meeting_note"===t.entity_type){let e=await (0,u.G)(t.entity_id);return!!e&&(0,u.q)(a,e)}return!1}async function c(e,t,a){let i=await (0,s.r)(e);if(!i)return!1;if("chat_message"===t){let t=await n.db.query(`
      SELECT TRUE AS ok
      FROM messages m
      INNER JOIN channels c ON c.id = m.channel_id
      INNER JOIN users u ON u.id = $1::uuid
      WHERE m.id = $2::uuid AND ${r.F}
      LIMIT 1
      `,[e,a]);return!!t.rows[0]?.ok}if("task"===t){let e=(await n.db.query("SELECT department_id::text, created_by::text FROM tasks WHERE id = $1::uuid",[a])).rows[0];return!!e&&(0,d.c)(i,{departmentId:e.department_id,createdBy:e.created_by})}if("meeting_note"===t){let e=await (0,u.G)(a);return!!e&&(0,u.q)(i,e)}return!1}async function m(e,t){let a=await (0,s.r)(e);return!!a&&("admin"===a.role||t.uploaded_by===e&&await l(e,t))}[n,d,u,s]=o.then?(await o)():o,i()}catch(e){i(e)}})},65465:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Hw:()=>o,K5:()=>s});var n=a(75748),r=a(95698),d=e([n]);function u(){let e=Number(process.env.RETENTION_FILES_DAYS);return Number.isFinite(e)&&e>0?e:30}function s(e){var t;if(t=e.entity_type,"chat_message"!==t&&"task"!==t)return!1;let a=u(),i=new Date(e.created_at);return i.setDate(i.getDate()+a),Date.now()>i.getTime()}async function o(){let e=u(),t=await n.db.connect(),a=0,i=[];try{await t.query("BEGIN");let n=await t.query(`
      SELECT id::text, storage_key
      FROM file_attachments
      WHERE entity_type IN ('chat_message', 'task')
        AND created_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,[e]);if(0===n.rows.length)return await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES (0)"),await t.query("COMMIT"),{filesDeleted:0};let r=n.rows.map(e=>e.id),d=await t.query(`
      DELETE FROM file_attachments
      WHERE id = ANY($1::uuid[])
      RETURNING storage_key
      `,[r]);for(let e of(a=d.rows.length,d.rows))i.push(e.storage_key);await t.query("INSERT INTO cleanup_logs (files_deleted) VALUES ($1)",[a]),await t.query("COMMIT")}catch(e){try{await t.query("ROLLBACK")}catch{}throw e}finally{t.release()}return await Promise.all(i.map(e=>(0,r.Yy)(e))),{filesDeleted:a}}n=(d.then?(await d)():d)[0],i()}catch(e){i(e)}})},95698:(e,t,a)=>{a.d(t,{D0:()=>m,Yy:()=>y,fu:()=>_,q5:()=>c});var i=a(84770),n=a(20629),r=a.n(n),d=a(55315),u=a.n(d);let s=u().join(process.cwd(),"storage","uploads"),o=new Set(["pdf","docx","xlsx","pptx","jpg","jpeg","png","zip"]),l={pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",zip:"application/zip"};function c(e){let t=u().basename(e),a=t.lastIndexOf(".");return -1===a?"":t.slice(a+1).toLowerCase()}async function m(e,t){let a=c(t);if(!a||!o.has(a))throw Error("unsupported_type");if(e.length>26214400)throw Error("too_large");let n=l[a.toLowerCase()]??"application/octet-stream",d=new Date,m=u().join(String(d.getFullYear()),String(d.getMonth()+1).padStart(2,"0")),y=u().join(s,m);await r().mkdir(y,{recursive:!0});let _=u().basename(t).replace(/[^a-zA-Z0-9._-가-힣]/g,"_").slice(0,200),p=`${(0,i.randomUUID)()}_${_||`file.${a}`}`,E=u().join(y,p);return await r().writeFile(E,e),{storageKey:u().join(m,p).replace(/\\/g,"/"),mimeType:n,byteSize:e.length}}async function y(e){let t=u().join(s,e),a=u().normalize(t);if(!a.startsWith(u().normalize(s)))throw Error("invalid_path");await r().unlink(a).catch(()=>void 0)}function _(e){return u().join(s,e)}},49185:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{G:()=>s,q:()=>u});var n=a(75748),r=a(27754),d=e([n,r]);async function u(e,t){return"admin"===e.role||(await (0,r.J)(e)).includes(t)}async function s(e){let t=await n.db.query("SELECT department_id::text FROM meeting_notes WHERE id = $1::uuid",[e]);return t.rows[0]?.department_id??null}[n,r]=d.then?(await d)():d,i()}catch(e){i(e)}})},27754:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{J:()=>d,d:()=>u});var n=a(75748),r=e([n]);async function d(e){if("admin"===e.role)return[];let t=e.departments.map(e=>e.id);if("member"===e.role)return t;let a=e.departments.filter(e=>"manager"===e.role).map(e=>e.id),i=new Set(t);if(0===a.length)return[...i];for(let e of(await n.db.query(`
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
    `,[a])).rows)i.add(e.id);return[...i]}async function u(e,t){return"admin"===e.role||!!t&&(await d(e)).includes(t)}n=(r.then?(await r)():r)[0],i()}catch(e){i(e)}})},61165:(e,t,a)=>{a.d(t,{v6:()=>d});var i=a(41482),n=a.n(i),r=a(1923);function d(e){let t=e.cookies.get(r.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},45043:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{c:()=>d});var n=a(27754),r=e([n]);async function d(e,t){return"admin"===e.role||(t.departmentId?(await (0,n.J)(e)).includes(t.departmentId):t.createdBy===e.id)}n=(r.then?(await r)():r)[0],i()}catch(e){i(e)}})},91978:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{r:()=>u});var n=a(75748),r=a(74034),d=e([n,r]);async function u(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let a=await (0,r.Z)(e),i=a.find(e=>e.isPrimary)??a[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:i?.departmentId??null,departmentName:i?.departmentName??null,departments:a.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,r]=d.then?(await d)():d,i()}catch(e){i(e)}})},74034:(e,t,a)=>{a.a(e,async(e,i)=>{try{a.d(t,{Z:()=>d});var n=a(75748),r=e([n]);async function d(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(r.then?(await r)():r)[0],i()}catch(e){i(e)}})}};