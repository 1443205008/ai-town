from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
chars=[]
for line in (root/'AI 沙海小镇 — 完整项目计划 v2.0.md').read_text().splitlines():
 if re.match(r'^\| \d\d \|',line):chars.append([s.strip() for s in line.split('|')[1:-1]])
histories=[
'曾在旧大陆修复一条被商会放弃的输水渠，却因拒绝篡改损耗报告失去职位。母亲在旱灾时病倒，让她相信透明测量比漂亮承诺更能救人。',
'曾负责移民车队的账本，一次没有列入预算的护卫费险些让大家断粮。他出钱补足缺口后，仍背负着对家人的私人债务，习惯先找资金来源。',
'在干旱期间守过临时病房，见过省下几桶清水却失去病人的结果。曾与管理者公开争吵，离开熟悉的医院后仍保留为每个人建立健康记录的习惯。',
'父亲经营的商队曾被突增的关税困在城外，货物变质后家里几乎破产。他学会在谈判中寻找双方都能接受的交换，也知道商路安全绝非免费的承诺。',
'带领工人修过城墙，因赶工事故失去一位朋友。来到沙海前把积蓄分给了对方家人，他对华丽蓝图并不反感，但始终要求工钱、工具和休息有保障。',
'从旱区农庄带来一小袋耐旱种子，曾因尝试新灌溉法被同乡嘲笑。后来那片试验田养活了整个冬季的家人，她愿意失败，却不愿让经验永远停在纸上。',
'车队途中曾丢失一批粮袋，众人怀疑他记账有误，后来发现是搬运时的误领。这件事让他对口头保证多留一分警惕，也愿意用清楚的记录洗去误会。',
'曾给旧大陆的小镇抄写会议纪要，见过一段含糊文字如何让弱势居民失去补偿。她相信不同的人有权说清自己的处境，耐心听完争论再记录真正的共识。',
'熟悉灰风隘口的季节变化，少年时跟随老师救回一队迷路的旅客。后来一次鲁莽远征让老师受伤，他从此宁愿多绕一段路，也不愿把陌生人推入未知危险。',
'曾在修理铺做学徒，凭一件改良工具赢得第一笔收入，却被雇主拿走署名。她想拥有自己的小作坊，让技艺换来尊重，也期待与真正懂材料的人合作。',
'车队缺粮时负责分餐，曾把自己的份额留给孩子。他知道食物不仅是库存数字，也是人们坐在一起说话的理由；希望建立一处让每个人都能吃饱的食堂。',
'家里的旅舍接待过各地迁徙者，后来一场火灾迫使她离开旧城。她懂得短暂的欢迎能给人重新开始的勇气，也担心没有床位的热情最终变成失望。',
'曾在商路护卫队工作，见过疏忽检查导致整队货物被抢。他为保护居民而守纪律，却也记得无辜旅客被过度盘查的委屈，努力寻找秩序和自由的界限。',
'曾在拥挤的旧城教孩子识字，学生因为缺钱辍学让她深感无力。移民路上仍带着旧课本，她相信一座只顾眼前生存的城镇也需要给下一代留下选择。',
'小时候喜欢描画河流，在一次测绘中发现旧地图遗漏的水口。家人不理解他为何总要走到远处，他把新大陆当作证明自己的机会，但仍欠缺谨慎的经验。',
'在迁徙途中照顾过受伤的亲人，受到萨娜的帮助后决定学习医术。她害怕犯错，也常因不想错失救人的机会主动承担任务，希望有一天能独立处理病情。',
'靠搬运和修路攒下一点钱，却在旧城的房租上涨后再次无家可归。一路帮邻居搭帐篷让他赢得信任，他愿意努力工作，但不愿把一辈子交给没兑现的承诺。',
'从小跟家人摆摊，曾因一次错误的摊位登记失去全部货物。她擅长估价和观察需求，尊重公平交易，却不信任没有明确边界的监管，希望积累自己的资产。',
'曾在废弃档案馆整理水利记录，发现古代聚落的笔记后被同行认为不切实际。他带着抄本来到沙海，希望验证旧井下的线索，也明白猜测必须接受证据检验。',
'曾替后来到达的移民争取过分配位置，被指责只顾自己人。旅途让她学会公开表达需求，也知道公平必须面对有限的物资；她希望让新来者获得真正的机会。']
folder=root/'seed/residents';folder.mkdir(parents=True,exist_ok=True)
for i,c in enumerate(chars):
 goal=c[3].split('；')[-1]
 background=f'{c[1]}是移民团中的{c[2]}。'+histories[i]+f'初到晨沙镇时，{c[1]}首先注意到水井、帐篷和仓库之间尚未建立稳定的生活秩序。沙海的环境让过去的经验既有价值又充满不确定性。眼下最想{goal}，但不能为了这件事牺牲基本的公平和个人尊严。与镇长合作的前提是愿意听取居民的实际困难，并让投入的劳动得到可验证的回应。'
 profile=dict(id=f'resident-{i+1:03}',name=c[1],role=c[2],background=background[:300],traits=dict(openness=35+i*7%60,conscientiousness=45+i*11%50,extraversion=25+i*13%65,agreeableness=35+i*17%60,stability=30+i*19%65),tendencies=[c[3].split('；')[0],'根据亲身经历评估承诺','拒绝不安全或无报酬的任务'],values=['生存','公平',goal],skills={c[2]:80,'建设':70 if i in [0,4,9,16] else 25,'农务':85 if i==5 else 20,'医疗':90 if i==2 else 50 if i==15 else 10},preferredJob=c[2],wagePreference=12+i%4,secret=f'{c[1]}曾经隐瞒过一次对家人的承诺，尚未告诉任何居民。',cash=100+i*20,items=['水袋'],debts=[dict(to='resident-002',amount=40)] if i==16 else [],homeId='building-6' if i<10 else 'building-7',goals=[dict(id=f'goal-{i}-short',term='SHORT',content='安顿并完成今日职业工作',status='ACTIVE'),dict(id=f'goal-{i}-mid',term='MID',content='寻找可信赖的合作伙伴',status='ACTIVE'),dict(id=f'goal-{i}-long',term='LONG',content=goal,status='ACTIVE')],relations={f'resident-{j+1:03}':dict(familiarity=20,trust=45,affection=40,respect=40,interest=0) for j in range(20) if j!=i},modelPolicy='RULES_ONLY',knowledge=[],memories=[])
 if i in [0,5,2,15]:profile['relations'][f'resident-{6 if i==0 else 1 if i==5 else 16 if i==2 else 3:03}'].update(trust=75,affection=70)
 if i==12:profile['relations']['resident-004'].update(trust=25,interest=-30)
 profile['knowledge']=[dict(id='rumor-ancient-well',content='据听说古井可能有地下水，尚未验证',source_type='HEARSAY',source_id='caravan-story',privacy='PRIVATE',confidence=.3,hearsay_depth=1)] if i==18 else []
 (folder/f'{profile["id"]}.json').write_text(json.dumps(profile,ensure_ascii=False,indent=2)+'\n')
print('20 位独立居民档案已生成。')
