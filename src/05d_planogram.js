(function(){
 const FD=globalThis.FD,E=(en,ar)=>({en,ar});
 Object.assign(FD.CATALOG,{
  PG_NEXT_CHECK:E('On your next visit to {store}, please check this display: {tip} Add a clear photo when you can.','في زيارتك القادمة إلى {store}، يرجى التحقق من هذا العرض: {tip} أضف صورة واضحة عندما تستطيع.'),PG_CATALOG_DATE:E('Catalogue data through {date}.','بيانات المنتجات حتى {date}.'),PG_NOT_SAVED:E('Photos could not be saved. Choose fewer or smaller images and try again. Other work can continue.','تعذّر حفظ الصور. اختر صوراً أقل أو أصغر وحاول مرة أخرى. يمكنك متابعة عملك.'),PG_TAB:E('Store intelligence','معلومات المحل'),PG_TAKE:E('Shelf photos','صور الأرفف'),
  PG_TAKE_PHOTOS:E('Take photo','التقاط صورة'),
  PG_CAPTURE_COMP:E('Take competitor photo','التقاط صورة للمنافس'),CI_TITLE:E('Competition','المنافسون'),CI_ADD:E('Add photo','أضف صورة'),
  CI_HINT:E("Take a photo of the other brand's display, price sign or new product. It is not part of Shelf Check.",'صوّر عرض العلامة الأخرى أو لافتة السعر أو المنتج الجديد. هذه الصورة ليست جزءاً من فحص الرف.'),
  CI_WHAT:E('What did you see?','ماذا رأيت؟'),CI_PRICE:E('Lower price or deal','سعر أقل أو عرض'),CI_DISPLAY:E('Own stand or display','ستاند أو عرض خاص'),CI_NEW:E('New product','منتج جديد'),CI_SPACE:E('More shelf space than us','مساحة رف أكبر منا'),
  CI_LOST:E('Lost to their deal: {n}','خسرناها لعرضه: {n}'),CI_PHOTOS:E('Photos: {n}','الصور: {n}'),CI_LAST:E('Last seen {date}','آخر مرة {date}'),
  CI_NONE:E('No competitor seen at this store in the last 60 days.','لم يُرصد منافس في هذا المحل خلال آخر 60 يوماً.'),
  CI_FROM:E('Last 60 days, from competitor photos, "Competitor deal" reasons and the latest Shelf Check.','آخر 60 يوماً، من صور المنافس وأسباب "عرض منافس" وآخر فحص للرف.'),PG_ADD_MORE:E('Add another photo','إضافة صورة أخرى'),PG_ADD:E('Add photos','إضافة صور'),PG_BEFORE:E('Before','قبل الترتيب'),PG_AFTER:E('After','بعد الترتيب'),
  PG_GUIDE:E('Face the display straight on. Include its edges and price labels. Keep product fronts clear.','واجه الرف مباشرة، وأظهر حوافه وبطاقات الأسعار وواجهات المنتجات بوضوح.'),
  PG_TIPS:E('Use the normal lens. Tap to focus, hold still and check glare. Match the angle for the after photo.','استخدم العدسة العادية، واضغط للتركيز وثبّت الهاتف وتجنب الانعكاس. استخدم الزاوية نفسها للصورة التالية.'),
  PG_SAVED:E('Photos saved','تم حفظ الصور'),PG_SAVING:E('Saving photos…','جارٍ حفظ الصور…'),PG_FAILED:E('{n} photos could not be saved. You can try them again.','تعذّر حفظ {n} صور. يمكنك المحاولة مرة أخرى.'),
  PG_PHOTO_LABEL:E('Open shelf photo','فتح صورة الرف'),PG_CAPTURED:E('Photos from {date}','صور بتاريخ {date}'),PG_PREVIOUS:E('Previous photos','الصور السابقة'),
  PG_COACH:E('Send coaching tip','إرسال نصيحة'),PG_REQUEST:E('Request a check','طلب فحص'),
  PG_ASSORTMENT:E('Store assortment','تشكيلة المحل'),PG_PURCHASED:E('Products purchased','المنتجات المشتراة'),PG_RECURRING:E('Recurring products','المنتجات المتكررة'),PG_GAPS:E('Recommended additions','إضافات موصى بها'),PG_HISTORY_SOURCE:E('From order history, not a shelf stock count','من سجل الطلبات، وليس تعداداً لمخزون الرف'),

  F_PLANOGRAM:E('Shelf Check at {store}','فحص الرف في {store}'),F_PLANOGRAM_C:E('{n} items: not in van, help needed or a damaged pack','{n} بنود: غير متوفر في السيارة أو يحتاج مساعدة أو عبوة تالفة'),ACT_PLANOGRAM:E('Open Shelf Check','فتح فحص الرف'),
  PG_VALUE:E('Compare pack value','مقارنة قيمة العبوات'),PG_VALUE_CHEAPER:E('{n}% lower cost per 100g','تكلفة أقل بنسبة {n}% لكل ١٠٠ غ'),PG_PACK_COST:E('Store pays / piece','يدفع المحل / قطعة'),PG_100G:E('Store pays / 100g','يدفع المحل / ١٠٠ غ'),PG_PRICE_BASIS:E('Price per piece from past orders, plus 15% VAT as on the store invoice. Compare the same selling unit.','سعر القطعة من الطلبات السابقة مع ضريبة ١٥٪ كما في فاتورة المحل. قارن وحدة البيع نفسها.'),
  PG_COLUMNS:E('Columns','الأعمدة'),PG_SEARCH_PRODUCTS:E('Search products','بحث المنتجات'),PG_BROWSE:E('Browse assortment','تصفح التشكيلة'),PG_ALL_PRODUCTS:E('All products','كل المنتجات'),PG_RESET:E('Clear filters','مسح المرشحات'),PG_PRODUCT_COUNT:E('{n} products','{n} منتجات'),PG_STORE_COUNT:E('Stores · {n}','المحلات · {n}'),PG_SHOWING:E('Showing {n} of {m} stores','عرض {n} من {m} محلاً'),PG_SORT:E('Sort by','ترتيب حسب'),PG_SORT_SALES:E('Highest sales','الأعلى مبيعاً'),PG_SORT_NAME:E('Product name','اسم المنتج'),PG_SORT_RETURNS:E('Highest returns','الأعلى مرتجعات'),PG_SORT_COST:E('Lowest cost per 100g','أقل تكلفة لكل ١٠٠ غ'),
  PG_BASE:E('Before recommendations','قبل التوصيات'),PG_PREVIOUS_PERIOD:E('Previous period','الفترة السابقة'),PG_VIEW:E('View store intelligence','عرض معلومات المحل'),
  // Shelf Check: fixed wording only. Analysis returns IDs; these strings are all a person ever reads.
  SC_TITLE:E('Shelf Check','فحص الرف'),SC_SCORE:E('Shelf Score','درجة الرف'),SC_OF_100:E('{n} / 100','{n} / ١٠٠'),SC_CHANGE:E('{change} points','{change} نقطة'),
  SC_PENDING:E('Score pending: part of the shelf could not be checked','الدرجة معلّقة: تعذّر فحص جزء من الرف'),
  SC_NOT_SAME:E('Before and After show different shelves. Take the After photo of the same display.','صورتا قبل وبعد لرفين مختلفين. التقط صورة بعد للعرض نفسه.'),
  SC_GOOD:E('Shelf looks good. Nothing to fix.','الرف بحالة جيدة. لا شيء يحتاج إلى إصلاح.'),SC_URGENT:E('Damaged pack: deal with this first','عبوة تالفة: تعامل معها أولاً'),
  SC_TODO:E('To do on this visit','المطلوب في هذه الزيارة'),SC_ISSUES:E('Issues','المشكلات'),SC_MORE_TODO:E('{n} more','{n} أخرى'),SC_NEW_ISSUES:E('New in the After photo','جديد في صورة بعد'),
  SC_FIXES:E('Fixes done','الإصلاحات المنجزة'),SC_N_OF_M:E('{n} of {m}','{n} من {m}'),SC_WAITING:E('{n} waiting for After photo','{n} بانتظار صورة بعد'),
  SC_OPEN:E('Open issues','مشكلات مفتوحة'),SC_BLOCKERS:E('Owner or stock','صاحب المحل أو المخزون'),SC_TAKE_AFTER:E('Take the After photo when you finish.','التقط صورة بعد عند الانتهاء.'),
  SC_AREA_FULL:E('Shelf full','الرف ممتلئ'),SC_AREA_FIND:E('Easy to find','سهل الإيجاد'),SC_AREA_COND:E('Good condition','بحالة جيدة'),
  SC_CHK_FULL_EMPTY_SPACE:E('Empty space in our display','مساحة فارغة في عرض منتجاتنا'),SC_CHK_FULL_NOT_FORWARD:E('Packs pushed to the back','العبوات في الخلف'),SC_CHK_FULL_EMPTY_CARTON:E('Display carton is empty','كرتون العرض فارغ'),
  SC_CHK_FIND_WRONG_AREA:E('Our products are next to non-food items','منتجاتنا بجانب مواد غير غذائية'),SC_CHK_FIND_HIDDEN:E('Our packs are hidden','عبواتنا مخفية'),SC_CHK_FIND_FACING:E('Packs face the wrong way','العبوات ليست بالاتجاه الصحيح'),SC_CHK_FIND_MIXED:E('Flavours are mixed up','النكهات مختلطة'),
  SC_CHK_COND_DAMAGED_PACK:E('Damaged pack on the shelf','عبوة تالفة على الرف'),SC_CHK_COND_CARTON:E('Display carton is torn or crushed','كرتون العرض ممزق أو منضغط'),SC_CHK_COND_ROTATION:E('Older stock is behind newer stock','البضاعة الأقدم خلف الأحدث'),
  SC_DO_FULL_EMPTY_SPACE:E('Fill the empty space.','املأ المساحة الفارغة.'),SC_DO_FULL_NOT_FORWARD:E('Bring the packs to the front.','قدّم العبوات إلى الأمام.'),SC_DO_FULL_EMPTY_CARTON:E('Refill the display carton.','أعد تعبئة كرتون العرض.'),
  SC_DO_FIND_WRONG_AREA:E('Ask the owner to move them to the food shelf.','اطلب من صاحب المحل نقلها إلى رف المواد الغذائية.'),SC_DO_FIND_HIDDEN:E('Move what is blocking our packs.','أزح ما يحجب عبواتنا.'),SC_DO_FIND_FACING:E('Turn the packs to face forward.','أدر العبوات لتكون واجهتها للأمام.'),SC_DO_FIND_MIXED:E('Put each flavour together.','اجمع كل نكهة معاً.'),
  SC_DO_COND_DAMAGED_PACK:E('Remove the damaged pack and report it.','أزل العبوة التالفة وأبلغ عنها.'),SC_DO_COND_CARTON:E('Replace the carton or fold a new display tray.','استبدل الكرتون أو جهّز صينية عرض جديدة.'),SC_DO_COND_ROTATION:E('Move older stock to the front.','قدّم البضاعة الأقدم إلى الأمام.'),
  SC_CLASS_FIX:E('Fix now','أصلحه الآن'),SC_CLASS_ASK:E('Ask owner','اسأل صاحب المحل'),
  SC_OUT_DONE:E('Done','تم'),SC_OUT_PARTLY_DONE:E('Partly done','تم جزئياً'),SC_OUT_NOT_IN_VAN:E('Not in van','غير متوفر في السيارة'),SC_OUT_OWNER_NO:E('Owner said no','رفض صاحب المحل'),SC_OUT_NEED_HELP:E('Need help','أحتاج مساعدة'),SC_OUT_OWNER_YES:E('Owner agreed','وافق صاحب المحل'),SC_OUT_OWNER_AWAY:E('Owner not there','صاحب المحل غير موجود'),SC_OUT_CANT:E("Couldn't do",'تعذّر التنفيذ'),
  SC_ST_OPEN:E('To do','مطلوب'),SC_ST_WAIT:E('Waiting for After photo','بانتظار صورة بعد'),SC_ST_FIXED:E('Fixed','تم الإصلاح'),SC_ST_PARTLY_FIXED:E('Partly fixed','تم إصلاحه جزئياً'),SC_ST_STILL:E('Still there','ما زال موجوداً'),SC_ST_CANT_CHECK:E("Couldn't check",'تعذّر التحقق'),SC_ST_NEW:E('New','جديد'),
  SC_PHOTO_OK:E('Photo OK','الصورة واضحة'),SC_PHOTO_PARTLY:E('Part of the shelf is not clear','جزء من الرف غير واضح'),SC_PHOTO_RETAKE:E('Retake the photo','أعد التقاط الصورة'),SC_PHOTO_NOT_SHELF:E("This photo doesn't show a cake or cookie display",'هذه الصورة لا تُظهر عرض كيك أو بسكويت'),SC_PHOTO_NONE:E("Shelf Check isn't available for this photo",'فحص الرف غير متاح لهذه الصورة'),
  SC_WHY_BLUR:E('Hold the phone steady.','ثبّت الهاتف.'),SC_WHY_DARK:E('Find better light.','اختر إضاءة أفضل.'),SC_WHY_GLARE:E('Change the angle to avoid glare.','غيّر الزاوية لتجنب الانعكاس.'),SC_WHY_CUT_OFF:E('Include the whole display.','أظهر منطقة العرض كاملة.'),SC_WHY_TOO_FAR:E('Move closer.','اقترب أكثر.'),SC_WHY_BLOCKED:E('Clear the view of the display.','أزل ما يحجب منطقة العرض.'),
  SC_COMPETITION:E('Competition seen','المنافسون في الصورة'),
  SC_COMP_NEXT:E('Competitor products next to ours','منتجات منافسة بجانب منتجاتنا'),SC_COMP_TRAY:E('Competitor uses a branded display','المنافس يستخدم عرضاً بعلامته'),SC_COMP_OFFER:E('Competitor offer sign visible','لافتة عرض للمنافس ظاهرة'),SC_COMP_NO_AMERICANA:E('Competitor products here, none of ours','منتجات منافسة هنا ولا يوجد من منتجاتنا'),SC_COMP_NONE:E('No competitor in these photos','لا يوجد منافس في هذه الصور'),
  SC_SEEN:E('Our products seen','منتجاتنا الظاهرة'),SC_NO_OURS:E('None of our products in this photo','لا توجد منتجاتنا في هذه الصورة'),SC_NOT_IN_PHOTO:E('Not in photo','غير ظاهرة في الصورة'),SC_PENDING_SHORT:E('Pending','معلّقة'),
  SC_FAM_CUPCAKE:E('Cupcakes','كب كيك'),SC_FAM_SWISS_ROLL:E('Swiss rolls','سويس رول'),SC_FAM_CAKE_BAR:E('Cake bars','كيك بار'),SC_FAM_SLICE_CAKE:E('Slice cakes','كيك شرائح'),SC_FAM_POUND_CAKE:E('Pound cakes','باوند كيك'),SC_FAM_BUTTER_COOKIES:E('Butter cookies','بسكويت الزبدة'),SC_FAM_CHOCO_COOKIES:E('Choco cookies','كوكيز الشوكولاتة'),SC_FAM_RUSK:E('Rusks','شابورة'),SC_FAM_OTHER_AMERICANA:E('Other Americana products','منتجات أمريكانا أخرى'),
  BR_SWITZ:E('Switz','سويتز'),BR_ALMARAI:E('Almarai','المراعي'),BR_SUNBULAH:E('Sunbulah','السنبلة'),BR_AL_KABEER:E('Al Kabeer','الكبير'),BR_UNKNOWN:E('Brand not readable','العلامة غير واضحة'),
  SC_NOT_CORRECT:E('Not correct','غير صحيح'),SC_REQ_NONE:E('No shelf photos yet','لا توجد صور للرف بعد'),SC_REQ_ASK:E('Request a check','طلب فحص'),SC_REQ_OPEN:E('Check requested {date} · waiting for the next visit','طُلب الفحص {date} · بانتظار الزيارة القادمة'),SC_REQ_DONE:E('Requested check done {date}','تم الفحص المطلوب {date}'),SC_REQ_BLOCKED:E("Couldn't check: {reason}",'تعذّر الفحص: {reason}'),
  SC_REQ_PHOTO:E('Photo received, check not done','تم استلام صورة، ولم يتم الفحص'),SC_REQ_CLOSED:E('Store closed','المحل مغلق'),SC_REQ_OWNER_NO:E('Owner said no','رفض صاحب المحل'),SC_REQ_NO_ACCESS:E("Couldn't reach the shelf",'تعذّر الوصول إلى الرف'),
  SC_REQ_VSR:E('Your supervisor asked for a shelf check','طلب مشرفك فحص الرف'),SC_REQ_TAKE:E('Take before photo','التقاط صورة قبل الترتيب'),SC_TODO_REQ:E('Shelf check at {store}','فحص الرف في {store}'),SC_TODO_FIX:E('Check fixes from the last visit at {store}','تحقق من إصلاحات الزيارة السابقة في {store}'),
  SC_TODO_H:E('Shelf checks','فحوصات الرف'),SC_NO_CHANGE:E('No changes needed','لا حاجة لتغييرات'),SC_NO_CHANGE_D:E('Shelf left as it was','بقي الرف كما هو'),SC_NO_CHANGE_UNDO:E('Undo','تراجع'),SC_SWAP:E('Swap Before and After','تبديل قبل وبعد'),SC_NEXT_VISIT:E('Checked on the next visit, {date}','تم التحقق في الزيارة التالية، {date}'),SC_FROM_LAST:E('From the last visit','من الزيارة السابقة'),SC_NEXT_LABEL:E('Next visit','الزيارة التالية'),SC_NO_AFTER:E('No After photo yet','لا توجد صورة بعد حتى الآن'),
  SC_NO_AFTER_VSR:E('Take the After photo of the same shelf when you finish.','التقط صورة بعد للرف نفسه عند الانتهاء.'),SC_NO_AFTER_SUP:E('The next photo of this shelf will appear here.','ستظهر هنا الصورة التالية لهذا الرف.'),
  SC_NEXT_CLOSED:E('Closed','مغلقة'),SC_NEXT_THIS:E('To do on this visit','المطلوب في هذه الزيارة'),SC_NEXT_VERIFY:E('Next: the After photo or the next visit confirms it','التالي: صورة بعد أو الزيارة القادمة تؤكدها'),
  SC_NEXT_OPEN:E('Stays open: next visit to-do and the store card','تبقى مفتوحة: مهمة الزيارة القادمة وبطاقة المحل'),SC_NEXT_TODAY:E('Also on Today for the supervisor','تظهر أيضاً في صفحة اليوم للمشرف'),
  SC_NEXT_OWNER:E('Stays on the store for a talk with the owner','تبقى على المحل للحديث مع صاحبه'),SC_NEXT_NEW:E('New issue: added to the next visit','مشكلة جديدة: أضيفت للزيارة القادمة'),
  SC_NONE:E('No Shelf Check yet. Take a Before photo at the next visit.','لا يوجد فحص للرف بعد. التقط صورة قبل في الزيارة القادمة.'),SC_HISTORY:E('Shelf Check history','سجل فحص الرف'),
  SC_SETTINGS:E('Shelf Score weights','أوزان درجة الرف'),SC_SETTINGS_D:E('How much each area counts in the Shelf Score. The total must be 100%. Changes apply to new checks only.','مقدار ما يحتسبه كل جانب في درجة الرف. يجب أن يكون المجموع ١٠٠٪. تُطبق التغييرات على الفحوصات الجديدة فقط.'),
  SC_TOTAL:E('Total {pct}','المجموع {pct}'),SC_RESET:E('Reset to defaults','إعادة الافتراضي'),SC_INSIDE:E('Inside each area, the more important checks count more.','داخل كل جانب، تُحتسب الفحوصات الأهم بوزن أكبر.'),
  SC_TEAM:E('Shelf Check by salesman','فحص الرف حسب المندوب'),
  SC_COL_STORES:E('Stores checked','محلات تم فحصها'),SC_COL_PHOTOS:E('Photos OK','صور واضحة'),SC_PAIRED:E('{n} stores with Before and After','{n} محلات بصورتي قبل وبعد'),SC_NO_TEAM:E('No Shelf Checks in this period','لا توجد فحوصات للرف في هذه الفترة')
 });
 const pg=st=>st.planogram||{assessments:[],columnPrefs:{}};
 // Three scored areas. Inside an area each check has a fixed importance (sums to 100); only the area weights are configurable.
 FD.SC_AREAS=[['FULL',[['FULL_EMPTY_SPACE',50],['FULL_NOT_FORWARD',30],['FULL_EMPTY_CARTON',20]]],['FIND',[['FIND_WRONG_AREA',35],['FIND_HIDDEN',30],['FIND_FACING',20],['FIND_MIXED',15]]],['COND',[['COND_DAMAGED_PACK',40],['COND_CARTON',30],['COND_ROTATION',30]]]]
  .map(([id,checks])=>({id,checks:checks.map(([check,weight])=>({check,weight}))}));
 FD.SC_CHECKS=FD.SC_AREAS.flatMap(a=>a.checks.map(c=>c.check));
 FD.SC_DEFAULT_WEIGHTS={FULL:40,FIND:35,COND:25};
 FD.SC_MIN_COVERAGE=80; // ponytail: fixed threshold for showing a score; make it a rule if supervisors need to tune it
 const PRIORITY=['COND_DAMAGED_PACK','FULL_EMPTY_SPACE','FULL_EMPTY_CARTON','FIND_WRONG_AREA','FIND_HIDDEN','COND_ROTATION','FULL_NOT_FORWARD','COND_CARTON','FIND_FACING','FIND_MIXED'];
 FD.scClass=c=>c==='FIND_WRONG_AREA'?'ASK':'FIX';
 FD.SC_OUTCOMES={FIX:['DONE','PARTLY_DONE','NOT_IN_VAN','OWNER_NO','NEED_HELP'],ASK:['OWNER_YES','OWNER_NO','OWNER_AWAY']};
 const BLOCKERS=['NOT_IN_VAN','OWNER_NO','NEED_HELP','OWNER_AWAY'];
 // A request stays OPEN until a photo that could be analysed arrives; photoReceived says a photo came in that gave no check yet.
 FD.scRequest=(st,store)=>{const r=((st.planogram||{}).requests||[]).filter(r=>r.store===store).slice(-1)[0];if(!r)return null;
  const from=r.at?r.at.date+r.at.time:'';
  return {...r,photoReceived:r.status==='OPEN'&&(st.photos||[]).some(p=>p.store===store&&p.assessmentId&&!p.kind&&(p.date+p.time)>=from)};};
 FD.scWeights=st=>Object.assign({},FD.SC_DEFAULT_WEIGHTS,st.rules.shelfWeights||{});
 FD.scResult=ref=>(ref!=null&&FD.SHELF_RESULTS&&FD.SHELF_RESULTS.photos[ref]||{}).result||null;
 FD.scLookup=name=>{const ps=(FD.SHELF_RESULTS||{}).photos||{};const k=Object.keys(ps).find(k=>ps[k].file===name);return k==null?null:+k;};
 FD.scUsable=r=>!!r&&r.scope==='AMBIENT_SHELF'&&(r.photo.status==='OK'||r.photo.status==='PARTLY');
 const met=c=>!c?null:c.result==='PASS'?1:c.result==='FAIL'?0:c.result==='PARTLY'?Math.min(1,Math.max(0,+c.met||0)):null;
 // Photos of one phase: the worst value seen for each check; 'NA' only when every photo says the check cannot exist.
 FD.scCombine=(results,dismissed={})=>Object.fromEntries(FD.SC_CHECKS.map(id=>{
  if(dismissed[id])return [id,null];const cs=results.map(r=>r.checks[id]).filter(Boolean),vs=cs.map(met).filter(v=>v!=null);
  return [id,vs.length?Math.min(...vs):cs.length&&cs.every(c=>c.result==='NOT_APPLICABLE')?'NA':null];}));
 // Shelf Score = earned / assessed budget; coverage = assessed / applicable budget. Unclear checks never count as pass or fail.
 FD.scScore=(vals,weights)=>{let got=0,seen=0,all=0;const areas={};
  for(const a of FD.SC_AREAS){let ag=0,as=0,aa=0;
   for(const c of a.checks){const v=vals[c.check];if(v==='NA')continue;const p=(weights[a.id]||0)*c.weight/100;aa+=p;if(v!=null){as+=p;ag+=p*v;}}
   areas[a.id]={score:as?100*ag/as:null,coverage:aa?100*as/aa:null};got+=ag;seen+=as;all+=aa;}
  const coverage=all?100*seen/all:0;return {score:seen?100*got/seen:null,coverage,final:seen>0&&coverage>=FD.SC_MIN_COVERAGE,none:!all,areas};};
 const sameDisplay=(i,j)=>i===j||((FD.SHELF_RESULTS||{}).groups||[]).some(g=>g.includes(i)&&g.includes(j));
 // cached per data version: the same check is summarised by many screens in one render
 FD.scSummary=(st,id)=>FD.cached?FD.cached('scs',st,id,()=>scSummary(st,id)):scSummary(st,id);
 const scSummary=(st,id)=>{
  const a=FD.pgAssessment(st,id);if(!a)return null;
  const photos=FD.pgPhotos(st,id).map(p=>{const r=FD.scResult(p.ref);return {p,r,status:r?r.photo.status:'NONE',reasons:r&&r.photo.status!=='OK'?r.photo.reasons||[]:[]};});
  const done=photos.filter(x=>x.r);if(!done.length)return {analysed:false,photos};
  const W=a.weights||FD.scWeights(st),phase=ph=>done.filter(x=>x.p.phase===ph&&FD.scUsable(x.r));
  let B=phase('BEFORE'),A=phase('AFTER'),next=false;
  // no After photo: the next visit's Before photo of the same display checks these issues
  if(B.length&&!A.length){const later=FD.pgAssessments(st,a.store).filter(x=>x.date+x.time>a.date+a.time).reverse();
   for(const n of later){const nb=FD.pgPhotos(st,n.id).filter(p=>p.phase==='BEFORE'&&FD.scUsable(FD.scResult(p.ref))&&B.some(y=>sameDisplay(p.ref,y.p.ref)));if(nb.length){A=nb.map(p=>({p,r:FD.scResult(p.ref)}));next=n.date;break;}}}
  const bv=FD.scCombine(B.map(x=>x.r),a.dismissed),av=A.length?FD.scCombine(A.map(x=>x.r),a.dismissed):null;
  // seeded demo checks carry extra conditions on top of the shared photo results, so stores differ
  for(const [ph,vals] of [[bv,(a.adjust||{}).BEFORE],[av,(a.adjust||{}).AFTER]])if(ph&&vals)for(const c in vals)if(typeof ph[c]==='number')ph[c]=Math.min(ph[c],vals[c]);
  const comparable=!!(B.length&&A.length&&A.every(x=>B.some(y=>sameDisplay(x.p.ref,y.p.ref))));
  const before=B.length?FD.scScore(bv,W):null,after=A.length?FD.scScore(av,W):null;
  const change=comparable&&before.final&&after.final?after.score-before.score:null;
  const mark=(list,check)=>{for(const x of list){const f=(x.r.findings||[]).find(f=>f.check===check);if(f)return {photoId:x.p.id,box:f.box_2d};}return null;};
  const findings=PRIORITY.filter(c=>typeof bv[c]==='number'&&bv[c]<1).map(c=>{
   const v=av&&av[c],status=!A.length?'OPEN':!comparable||v==null||v==='NA'?'CANT_CHECK':v>=1?'FIXED':v>bv[c]?'PARTLY_FIXED':'STILL';
   return {check:c,met:bv[c],cls:FD.scClass(c),outcome:(a.actions||{})[c]||null,status,mark:mark(B,c),markAfter:A.length?mark(A,c):null,urgent:c==='COND_DAMAGED_PACK'};});
  const fresh=comparable?PRIORITY.filter(c=>typeof av[c]==='number'&&av[c]<1&&bv[c]===1).map(c=>({check:c,met:av[c],cls:FD.scClass(c),status:'NEW',mark:mark(A,c)})):[];
  const fix=findings.filter(f=>f.cls==='FIX'&&!BLOCKERS.includes(f.outcome));
  const fixes={verified:fix.filter(f=>f.status==='FIXED').length,total:fix.length,waiting:fix.filter(f=>f.status==='OPEN'&&f.outcome==='DONE').length};
  const blockers=findings.filter(f=>BLOCKERS.includes(f.outcome)&&f.status!=='FIXED');
  // A Before and an After of one display are one sighting each, not two to add up.
  const comp=new Map();for(const x of done.filter(x=>FD.scUsable(x.r)))for(const c of x.r.competition||[])if(c.signal!=='COMP_NONE')comp.set(c.signal+'|'+(c.brand||'UNKNOWN'),{signal:c.signal,brand:c.brand||'UNKNOWN'});
  // the photos to compare: this check's Before, and its After or the next visit's photo of the same display
  const cmp={before:B.map(x=>x.p),after:A.map(x=>x.p),afterSource:next?'NEXT':A.length?'AFTER':null};
  return {analysed:true,photos,weights:W,before,after,comparable,nextVisit:next,cmp,mismatch:!!(B.length&&A.length&&!comparable),change,findings,fresh,fixes,blockers,
   open:findings.filter(f=>f.status!=='FIXED').length+fresh.length,competition:[...comp.values()],seen:[...new Set(done.flatMap(x=>FD.scUsable(x.r)?x.r.americana_seen||[]:[]))],
   urgent:findings.some(f=>f.urgent&&f.status!=='FIXED'),current:after||before,good:!!(before&&before.final&&!findings.length)};
 };
 const avg=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
 // One row per salesman: the latest analysed check at each store they visited in the period. No rank.
 FD.scTeam=(st,from,to,ids)=>ids.map(vsr=>{
  const latest=new Map();for(const a of pg(st).assessments.filter(a=>a.vsr===vsr&&a.by!=='SUP'&&a.date>=from&&a.date<=to)){const s=FD.scSummary(st,a.id);if(!s||!s.analysed||!s.current)continue;const o=latest.get(a.store);if(!o||o.a.date+o.a.time<a.date+a.time)latest.set(a.store,{a,s});}
  const sums=[...latest.values()].map(x=>x.s),finals=sums.filter(s=>s.current.final),paired=sums.filter(s=>s.change!=null),shots=sums.flatMap(s=>s.photos.filter(x=>['OK','PARTLY','RETAKE'].includes(x.status)));
  const n=k=>sums.reduce((t,s)=>t+s.fixes[k],0);
  return {vsr,stores:sums.length,finalStores:finals.length,score:finals.length?avg(finals.map(s=>s.current.score)):null,change:paired.length?avg(paired.map(s=>s.change)):null,paired:paired.length,
   fixes:{verified:n('verified'),total:n('total'),waiting:n('waiting')},open:sums.reduce((t,s)=>t+s.open,0),blockers:sums.reduce((t,s)=>t+s.blockers.length,0),photosOk:shots.filter(x=>x.status!=='RETAKE').length,photos:shots.length,stores_:[...latest.values()]};
 });
 FD.pgAssortment=(st,store,date)=>{
  const purchased=FD.storeSkuStats(st,store,date), recurring=purchased.filter(x=>st.orders.filter(o=>o.store===store&&o.sku===x.code&&o.date<=date&&o.units>0).map(o=>o.date).filter((d,i,a)=>a.indexOf(d)===i).length>=2);
  const gaps=FD.recommend(st,store,date).recs.filter(x=>x.type==='GAP'||x.type==='UPGRADE');
  return {purchased,recurring,gaps};
 };
 // Supervisor work still open from any earlier visit: blockers the salesman cannot clear alone, and damaged packs.
 // An item is closed once a later check at the same store shows it fixed or gone.
 FD.pgFollowUps=st=>{const by=new Map(),out=[];
  for(const a of pg(st).assessments)if(a.date<=st.clock.date){if(!by.has(a.store))by.set(a.store,[]);by.get(a.store).push(a);}
  for(const list of by.values()){list.sort((x,y)=>(y.date+y.time).localeCompare(x.date+x.time));const sums=list.map(a=>FD.scSummary(st,a.id));
   list.forEach((a,i)=>{const s=sums[i];if(!s||!s.analysed)return;
    const L=sums.slice(0,i).find(x=>x&&x.analysed&&x.current), still=c=>!L||L.findings.concat(L.fresh).some(f=>f.check===c&&f.status!=='FIXED');
    const need=s.blockers.filter(f=>['NEED_HELP','NOT_IN_VAN'].includes(f.outcome)&&still(f.check)),n=need.length+(s.urgent&&still('COND_DAMAGED_PACK')&&!need.some(f=>f.urgent)?1:0);if(!n)return; // owner refusals stay on the store, not in the morning queue
    out.push({key:'F_PLANOGRAM|'+a.id,tpl:'F_PLANOGRAM',pri:2,at:a.date,slots:{storeId:a.store,vsrId:a.vsr,n},action:{kind:'planogram',type:'PLANOGRAM_REVIEW',label:'ACT_PLANOGRAM',store:a.store,assessmentId:a.id}});});}
  return out;};
 // Seed: field photos already placed at stores become that visit's Before check; same-display groups supply real After photos.
 FD.scSeed=st=>{
  if(!FD.SHELF_RESULTS)return;const P=st.planogram||(st.planogram={assessments:[],columnPrefs:{}}),by=new Map();
  const visited=new Set(st.visits.filter(v=>v.status==='DONE').map(v=>v.store+'|'+v.date)),last={}; // a check needs a real visit
  for(const p of st.photos.filter(p=>p.seeded&&visited.has(p.store+'|'+p.date)))if(!last[p.store]||p.date>last[p.store])last[p.store]=p.date;
  for(const p of st.photos.filter(p=>p.seeded&&p.date===last[p.store]&&FD.scUsable(FD.scResult(p.ref)))){const k=p.store+'|'+p.date;if(!by.has(k))by.set(k,[]);by.get(k).push(p);}
  let n=0;
  for(const ps of by.values()){const f=ps[0],id='SC'+(++n);
   P.assessments.push({id,store:f.store,vsr:f.vsr,visitId:null,date:f.date,time:f.time,photoIds:ps.map(p=>p.id),weights:{...FD.SC_DEFAULT_WEIGHTS},actions:{},dismissed:{},seeded:true});
   for(const p of ps){p.assessmentId=id;p.phase='BEFORE';}
   const partner=((FD.SHELF_RESULTS.groups||[]).find(g=>g[0]===f.ref&&g.every(r=>(FD.scResult(r).americana_seen||[]).length))||[])[1];
   if(partner!=null&&!ps.some(p=>p.ref===partner)){const ph={id:id+'-after',src:FD.PHOTOS[partner],store:f.store,vsr:f.vsr,date:f.date,time:f.time,assessmentId:id,phase:'AFTER',ref:partner,seeded:true};st.photos.push(ph);P.assessments.at(-1).photoIds.push(ph.id);}
   const a=P.assessments.at(-1),pick=(n*7919)%100;
   // demo variety: about two in three stores get one to three conditions; damaged packs stay rare
   if(pick<65){const pool=['FULL_EMPTY_SPACE','FIND_HIDDEN','FULL_NOT_FORWARD','COND_CARTON','FIND_FACING','FIND_MIXED','COND_ROTATION','FIND_WRONG_AREA','FULL_EMPTY_CARTON'].concat(pick%11===0?['COND_DAMAGED_PACK']:[]);
    const k=1+pick%3,B={};for(let i=0;i<k;i++){const c=pool[(n*3+i*5)%pool.length];B[c]=[0,0.5,0,0.25][(n+i)%4];}
    a.adjust={BEFORE:B};}
   const s=FD.scSummary(st,id);
   // outcomes agree with what the After photo shows
   s.findings.forEach((x,k)=>{a.actions[x.check]=x.cls==='ASK'?(x.status==='FIXED'?'OWNER_YES':x.status==='STILL'?'OWNER_NO':FD.SC_OUTCOMES.ASK[(n+k)%3])
    :x.status==='FIXED'?'DONE':x.status==='PARTLY_FIXED'?'PARTLY_DONE':x.status==='STILL'?(((n+k)%6===0)?'NOT_IN_VAN':'OWNER_NO'):((n+k)%40===7?'NOT_IN_VAN':(n+k)%40===23?'NEED_HELP':(n+k)%9===4?'PARTLY_DONE':'DONE');});}
 };
})();
