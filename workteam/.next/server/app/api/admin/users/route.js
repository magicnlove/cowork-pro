"use strict";(()=>{var e={};e.id=2628,e.ids=[2628],e.modules={67096:e=>{e.exports=require("bcrypt")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},76162:e=>{e.exports=require("stream")},21764:e=>{e.exports=require("util")},8678:e=>{e.exports=import("pg")},91145:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>_,patchFetch:()=>m,requestAsyncStorage:()=>l,routeModule:()=>o,serverHooks:()=>c,staticGenerationAsyncStorage:()=>p});var n=r(49303),s=r(88716),i=r(60670),u=r(6694),d=e([u]);u=(d.then?(await d)():d)[0];let o=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/admin/users/route",pathname:"/api/admin/users",filename:"route",bundlePath:"app/api/admin/users/route"},resolvedPagePath:"C:\\Users\\User\\Desktop\\All of Me\\private\\현직장\\한화투자증권\\개발\\workteam\\src\\app\\api\\admin\\users\\route.ts",nextConfigOutput:"",userland:u}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:c}=o,_="/api/admin/users/route";function m(){return(0,i.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:p})}a()}catch(e){a(e)}})},6694:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>_,POST:()=>y});var n=r(67096),s=r.n(n),i=r(87070),u=r(91585),d=r(75748),m=r(1327),o=r(19370),l=r(61165),p=r(91978),c=e([d,p]);[d,p]=c.then?(await c)():c;let E=u.Km(["admin","manager","member"]),f=u.Km(["admin","manager","member"]),h=u.Ry({departmentId:u.Z_().uuid(),isPrimary:u.O7().optional(),role:f}),g=u.Ry({email:u.Z_().email(),password:u.Z_().min(8).max(200),name:u.Z_().min(1).max(100),role:E,departmentAssignments:u.IX(h).max(30).optional().default([])});async function _(e){let t=(0,l.v6)(e);if(!t)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let r=await (0,p.r)(t.sub),a=(0,m.v)(r);if(a)return a;let n=e.nextUrl.searchParams,s=n.get("name")?.trim()??"",o=n.get("email")?.trim()??"",c=n.get("role")?.trim()??"",_=n.get("departmentId")?.trim()??"",y=[],E=[],f=1;s&&(y.push(`u.name ILIKE $${f}`),E.push(`%${s}%`),f+=1),o&&(y.push(`u.email ILIKE $${f}`),E.push(`%${o}%`),f+=1),("admin"===c||"manager"===c||"member"===c)&&(y.push(`u.role = $${f}`),E.push(c),f+=1),_&&u.Z_().uuid().safeParse(_).success&&(y.push(`EXISTS (SELECT 1 FROM user_departments ud2 WHERE ud2.user_id = u.id AND ud2.department_id = $${f}::uuid)`),E.push(_),f+=1);let h=y.length>0?`WHERE ${y.join(" AND ")}`:"",g=await d.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'departmentId', ud.department_id::text,
            'departmentName', d.name,
            'role', ud.role,
            'isPrimary', ud.is_primary
          )
          ORDER BY ud.is_primary DESC, d.name ASC
        ) FILTER (WHERE ud.id IS NOT NULL),
        '[]'::json
      ) AS department_assignments,
      u.created_at
    FROM users u
    LEFT JOIN user_departments ud ON ud.user_id = u.id
    LEFT JOIN departments d ON d.id = ud.department_id
    ${h}
    GROUP BY u.id, u.email, u.name, u.role, u.created_at
    ORDER BY u.name ASC
    `,E);return i.NextResponse.json({users:g.rows.map(e=>({id:e.id,email:e.email,name:e.name,role:e.role,departmentAssignments:e.department_assignments,departmentId:e.department_assignments.find(e=>e.isPrimary)?.departmentId??e.department_assignments[0]?.departmentId??null,departmentName:e.department_assignments.find(e=>e.isPrimary)?.departmentName??e.department_assignments[0]?.departmentName??null,createdAt:e.created_at.toISOString()}))})}async function y(e){let t;let r=(0,l.v6)(e);if(!r)return i.NextResponse.json({message:"로그인이 필요합니다."},{status:401});let a=await (0,p.r)(r.sub),n=(0,m.v)(a);if(n)return n;try{t=await e.json()}catch{return i.NextResponse.json({message:"잘못된 JSON입니다."},{status:400})}let u=g.safeParse(t);if(!u.success)return i.NextResponse.json({message:"입력값이 올바르지 않습니다.",issues:u.error.flatten()},{status:400});let{email:c,password:_,name:y,role:E,departmentAssignments:f}=u.data,h=(0,o.f)(_);if(h)return i.NextResponse.json({message:h},{status:400});let R=await s().hash(_,12),N=c.toLowerCase(),x=f.map((e,t)=>({...e,isPrimary:!!e.isPrimary}));if(x.length>0&&!x.some(e=>e.isPrimary)&&(x[0].isPrimary=!0),x.filter(e=>e.isPrimary).length>1)return i.NextResponse.json({message:"주 소속 부서는 하나만 선택할 수 있습니다."},{status:400});let S=await d.db.connect();try{await S.query("BEGIN");let e=(await S.query(`
      INSERT INTO users (email, password_hash, name, role, is_temp_password)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id::text
      `,[N,R,y,E])).rows[0].id;for(let t of x)await S.query(`
        INSERT INTO user_departments (user_id, department_id, is_primary, role)
        VALUES ($1::uuid, $2::uuid, $3, $4)
        ON CONFLICT (user_id, department_id) DO UPDATE
        SET is_primary = EXCLUDED.is_primary, role = EXCLUDED.role
        `,[e,t.departmentId,t.isPrimary,t.role]);return await S.query("COMMIT"),i.NextResponse.json({id:e})}catch(e){return await S.query("ROLLBACK"),console.error("[POST /api/admin/users]",e),i.NextResponse.json({message:"사용자를 만들지 못했습니다. 이메일 중복 여부를 확인해 주세요."},{status:500})}finally{S.release()}}a()}catch(e){a(e)}})},1923:(e,t,r)=>{r.d(t,{S:()=>n,l:()=>a});let a="auth_token",n="password_change_required"},75748:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{db:()=>i});var n=r(8678),s=e([n]);n=(s.then?(await s)():s)[0];let i=global.__pgPool??new n.Pool({connectionString:function(){let e=process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL is not configured.");return e}()});a()}catch(e){a(e)}})},19370:(e,t,r)=>{r.d(t,{f:()=>n,h:()=>function e(){let t="ABCDEFGHJKLMNPQRSTUVWXYZ",r="abcdefghjkmnpqrstuvwxyz",a="23456789",s="!@#$%&*",i=t+r+a+s,u=e=>e[Math.floor(Math.random()*e.length)],d=u(t)+u(r)+u(a)+u(s);for(let e=0;e<8;e++)d+=u(i);let m=d.split("");for(let e=m.length-1;e>0;e--){let t=Math.floor(Math.random()*(e+1));[m[e],m[t]]=[m[t],m[e]]}let o=m.join("");return null!==n(o)?e():o}});let a=/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;function n(e){return e.length<8?"비밀번호는 8자 이상이어야 합니다.":/[A-Za-z]/.test(e)?/[0-9]/.test(e)?a.test(e)?null:"비밀번호에 특수문자를 포함해야 합니다.":"비밀번호에 숫자를 포함해야 합니다.":"비밀번호에 영문을 포함해야 합니다."}},1327:(e,t,r)=>{r.d(t,{v:()=>n});var a=r(87070);function n(e){return e?"admin"!==e.role?a.NextResponse.json({message:"관리자만 접근할 수 있습니다."},{status:403}):null:a.NextResponse.json({message:"로그인이 필요합니다."},{status:401})}},61165:(e,t,r)=>{r.d(t,{v6:()=>i});var a=r(41482),n=r.n(a),s=r(1923);function i(e){let t=e.cookies.get(s.l)?.value;return t?function(e){try{let t=n().verify(e,function(){let e=process.env.JWT_SECRET;if(!e)throw Error("JWT_SECRET is not configured.");return e}());if("object"==typeof t&&null!==t&&"sub"in t&&"email"in t)return{sub:String(t.sub),email:String(t.email)};return null}catch{return null}}(t):null}},91978:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{r:()=>u});var n=r(75748),s=r(74034),i=e([n,s]);async function u(e){if(!e||"undefined"===e)return null;let t=(await n.db.query(`
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,[e])).rows[0];if(!t)return null;let r=await (0,s.Z)(e),a=r.find(e=>e.isPrimary)??r[0]??null;return{id:t.id,email:t.email,name:t.name,role:t.role,departmentId:a?.departmentId??null,departmentName:a?.departmentName??null,departments:r.map(e=>({id:e.departmentId,name:e.departmentName,isPrimary:e.isPrimary,role:e.role}))}}[n,s]=i.then?(await i)():i,a()}catch(e){a(e)}})},74034:(e,t,r)=>{r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>i});var n=r(75748),s=e([n]);async function i(e){return(await n.db.query(`
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
    `,[e])).rows.map(e=>({id:e.id,userId:e.user_id,departmentId:e.department_id,departmentName:e.department_name,isPrimary:e.is_primary,role:e.role}))}n=(s.then?(await s)():s)[0],a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[9276,5972,1482,1585],()=>r(91145));module.exports=a})();