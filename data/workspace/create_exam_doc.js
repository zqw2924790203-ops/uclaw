const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, BorderStyle } = require('docx');
const fs = require('fs');

// 创建选择题的函数
function createChoiceQuestion(num, type, question, options, answer) {
  const children = [
    new TextRun({ text: num + ". " + question, bold: true, font: "Arial", size: 24 }),
    new TextRun({ text: "【" + type + "】", color: "C00000", font: "Arial", size: 22 }),
  ];
  
  options.forEach((opt, idx) => {
    children.push(new TextRun({ text: "\n    " + String.fromCharCode(65 + idx) + ". " + opt, font: "Arial", size: 24 }));
  });
  
  children.push(new TextRun({ text: "\n参考答案：" + answer, color: "0070C0", font: "Arial", size: 22, bold: true }));
  
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    children: children
  });
}

// 创建判断题的函数
function createJudgeQuestion(num, question, answer) {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({ text: num + ". " + question, bold: true, font: "Arial", size: 24 }),
      new TextRun({ text: "【判断题】", color: "C00000", font: "Arial", size: 22 }),
      new TextRun({ text: "\n参考答案：" + answer, color: "0070C0", font: "Arial", size: 22, bold: true }),
    ]
  });
}

// 创建简答题的函数
function createShortQuestion(num, question, keyPoints) {
  const children = [
    new TextRun({ text: num + ". " + question, bold: true, font: "Arial", size: 24 }),
    new TextRun({ text: "【简答题】", color: "C00000", font: "Arial", size: 22 }),
  ];
  
  children.push(new TextRun({ text: "\n参考答案要点：", bold: true, font: "Arial", size: 22, color: "0070C0" }));
  keyPoints.forEach((point, idx) => {
    children.push(new TextRun({ text: "\n    " + (idx + 1) + ". " + point, font: "Arial", size: 22 }));
  });
  
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    children: children
  });
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 24 } }
    }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // 标题
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400 },
        children: [
          new TextRun({ text: "党支部理论学习考核模拟试题", bold: true, font: "Arial", size: 40, color: "C00000" })
        ]
      }),
      
      // 说明
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [
          new TextRun({ text: "（本试卷根据提供的理论学习及视频教学资料整理）", font: "Arial", size: 22, color: "666666" })
        ]
      }),
      
      new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }),
      
      // 一、单项选择题
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [new TextRun({ text: "一、单项选择题", bold: true, font: "Arial", size: 28 })]
      }),
      
      createChoiceQuestion(1, "单选", "根据《中国共产党章程》，中国共产党的最高理想和最终目标是什么？", 
        ["实现共产主义", "建设社会主义现代化强国", "实现中华民族伟大复兴", "建成小康社会"], "A"),
      
      createChoiceQuestion(2, "单选", "根据《中国共产党章程》，申请入党的人，要填写入党志愿书，要有几名正式党员作介绍人？", 
        ["一名", "两名", "三名", "四名"], "B"),
      
      createChoiceQuestion(3, "单选", "《中国共产党支部工作条例（试行）》规定，党支部党员人数一般不超过多少人？", 
        ["30人", "50人", "100人", "200人"], "B"),
      
      createChoiceQuestion(4, "单选", "《中国共产党党员教育管理工作条例》要求，党员每年集中学习培训时间一般不少于多少学时？", 
        ["24学时", "32学时", "48学时", "64学时"], "B"),
      
      createChoiceQuestion(5, "单选", "根据《中国共产党纪律处分条例》，党的纪律处分工作应当坚持党要管党、全面从严治党的原则，加强对党的各级组织和全体党员的什么教育、管理和监督？", 
        ["纪律", "规矩", "作风", "廉政"], "A"),
      
      createChoiceQuestion(6, "单选", "党的二十大报告指出，从现在起，中国共产党的中心任务是什么？", 
        ["全面建设社会主义现代化强国", "全面建成社会主义现代化强国", "实现中华民族伟大复兴", "建成小康社会"], "B"),
      
      createChoiceQuestion(7, "单选", "《榜样10》节目中，不包括以下哪位人物（或群体）？", 
        ["张桂梅", "陈红军", "王继才", "雷锋"], "D"),
      
      createChoiceQuestion(8, "单选", "根据《党课开讲啦—党的光辉历程》，中国共产党的光辉历程是从哪一年开始的？", 
        ["1911年", "1919年", "1921年", "1949年"], "C"),
      
      createChoiceQuestion(9, "单选", "《中国共产党章程》规定，党员如果没有正当理由，连续多长时间不参加党的组织生活，就被认为是自行脱党？", 
        ["三个月", "六个月", "九个月", "十二个月"], "B"),
      
      createChoiceQuestion(10, "单选", "《中国共产党支部工作条例（试行）》规定，党支部应当组织党员按期参加什么会议？", 
        ["党小组会", "支部委员会", "党员大会", "以上都是"], "D"),
      
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }),
      
      // 二、多项选择题
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [new TextRun({ text: "二、多项选择题", bold: true, font: "Arial", size: 28 })]
      }),
      
      createChoiceQuestion(1, "多选", "《中国共产党章程》规定，党员应当履行的义务包括哪些？", 
        ["学习党的基本理论、基本知识", "贯彻执行党的基本路线和各项方针、政策", "坚持党和人民的利益高于一切", "自觉遵守党的纪律"], "ABCD"),
      
      createChoiceQuestion(2, "多选", "《中国共产党支部工作条例（试行）》规定的党支部的基本任务包括哪些？", 
        ["宣传和贯彻落实党的理论和路线方针政策", "管理党员", "监督党员和群众", "发展党员"], "ABCD"),
      
      createChoiceQuestion(3, "多选", "《中国共产党纪律处分条例》规定的处分种类包括哪些？", 
        ["警告", "严重警告", "撤销党内职务", "留党察看", "开除党籍"], "ABCDE"),
      
      createChoiceQuestion(4, "多选", "党的二十大报告提出的'三个务必'是什么？", 
        ["务必不忘初心、牢记使命", "务必谦虚谨慎、艰苦奋斗", "务必敢于斗争、善于斗争", "务必全心全意为人民服务"], "ABC"),
      
      createChoiceQuestion(5, "多选", "《中国共产党党员教育管理工作条例》规定的党员教育应当遵循的原则有哪些？", 
        ["坚持党要管党、全面从严治党", "坚持以党的政治建设为统领", "坚持继承和创新相统一", "坚持从严管理"], "ABC"),
      
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }),
      
      // 三、判断题
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [new TextRun({ text: "三、判断题", bold: true, font: "Arial", size: 28 })]
      }),
      
      createJudgeQuestion(1, "《中国共产党章程》明确规定，中国共产党以马克思列宁主义、毛泽东思想、邓小平理论、'三个代表'重要思想、科学发展观、习近平新时代中国特色社会主义思想作为自己的行动指南。", "正确"),
      
      createJudgeQuestion(2, "《中国共产党支部工作条例（试行）》规定，党支部的成立，一般由基层单位提出申请，所在乡镇（街道）或者单位基层党委召开会议研究决定并批复，批复时间不超过一个月。", "错误（批复时间不超过2个月）"),
      
      createJudgeQuestion(3, "《中国共产党纪律处分条例》仅适用于违犯党纪的党组织和党员。", "正确"),
      
      createJudgeQuestion(4, "党的二十大报告指出，中国式现代化是中国共产党领导的社会主义现代化。", "正确"),
      
      createJudgeQuestion(5, "《榜样10》展现的是各行各业优秀共产党员的先进事迹。", "正确"),
      
      createJudgeQuestion(6, "根据《党课开讲啦—党的光辉历程》，党的光辉历程证明只有中国共产党才能救中国，只有中国特色社会主义才能发展中国。", "正确"),
      
      createJudgeQuestion(7, "《中国共产党党员教育管理工作条例》规定，党员每年集中学习培训时间一般不少于48学时。", "错误（一般不少于32学时）"),
      
      createJudgeQuestion(8, "党章规定，党员有退党的自由。", "正确"),
      
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }),
      
      // 四、简答题
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [new TextRun({ text: "四、简答题", bold: true, font: "Arial", size: 28 })]
      }),
      
      createShortQuestion(1, "请简述《中国共产党章程》规定的党员必须履行的基本义务。", [
        "（1）认真学习马克思列宁主义、毛泽东思想、邓小平理论、'三个代表'重要思想、科学发展观、习近平新时代中国特色社会主义思想；",
        "（2）贯彻执行党的基本路线和各项方针、政策，带头参加改革开放和社会主义现代化建设；",
        "（3）坚持党和人民的利益高于一切，个人利益服从党和人民的利益，吃苦在前，享受在后；",
        "（4）自觉遵守党的纪律，首先是党的政治纪律和政治规矩；",
        "（5）维护党的团结和统一，对党忠诚老实，言行一致；",
        "（6）切实开展批评和自我批评，勇于揭露和纠正违反党的原则的言行；",
        "（7）密切联系群众，向群众宣传党的主张，遇事同群众商量；",
        "（8）发扬社会主义新风尚，带头实践社会主义核心价值观。"
      ]),
      
      createShortQuestion(2, "请简述党支部的五大基本任务。", [
        "（1）宣传和贯彻落实党的理论和路线方针政策；",
        "（2）管理党员：组织党员参加党的组织生活，教育、管理、监督党员；",
        "（3）密切联系群众：密切联系群众，做好群众的思想政治工作；",
        "（4）监督党员和群众：监督党员干部和其他工作人员严格遵守国家法律法规；",
        "（5）培养和发展党员：发现、培养和推荐优秀人才入党。"
      ]),
      
      createShortQuestion(3, "请简述党的二十大报告中提出的中国式现代化的五个特征。", [
        "（1）中国式现代化是人口规模巨大的现代化；",
        "（2）中国式现代化是全体人民共同富裕的现代化；",
        "（3）中国式现代化是物质文明和精神文明相协调的现代化；",
        "（4）中国式现代化是人与自然和谐共生的现代化；",
        "（5）中国式现代化是走和平发展道路的现代化。"
      ]),
      
      createShortQuestion(4, "《中国共产党纪律处分条例》规定的党的纪律主要包括哪几项？", [
        "（1）政治纪律：最重要、最根本、最关键的纪律；",
        "（2）组织纪律：规范党的组织建设、组织活动的纪律；",
        "（3）廉洁纪律：规范党员廉洁从业、廉洁用权的纪律；",
        "（4）群众纪律：规范党组织和党员与人民群众关系的纪律；",
        "（5）工作纪律：规范党的各项工作活动的纪律；",
        "（6）生活纪律：规范党员日常生活和社会交往的纪律。"
      ]),
      
      createShortQuestion(5, "请简述《榜样10》中让你印象最深刻的一个榜样及其主要事迹。", [
        "（参考要点：张桂梅——扎根边疆教育事业数十年，创办华坪女子高级中学，帮助近2000名贫困山区女孩走出大山；",
        "陈红军——戍边英雄，在加勒万河谷冲突中英勇牺牲；",
        "王继才——守岛32年，用坚守诠释爱国奉献精神；",
        "黄大年——心有大我、至诚报国的科学家；",
        "等。要求：事迹表述准确，精神概括到位。）"
      ]),
      
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }),
      
      // 备注
      new Paragraph({
        spacing: { before: 300, after: 200 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "C00000" } },
        children: [
          new TextRun({ text: "备注：", bold: true, font: "Arial", size: 22, color: "C00000" }),
          new TextRun({ text: "本套试题根据以下学习资料整理：", font: "Arial", size: 22 }),
          new TextRun({ text: "\n1.《中国共产党章程》", font: "Arial", size: 22 }),
          new TextRun({ text: "\n2.《中国共产党支部工作条例（试行）》", font: "Arial", size: 22 }),
          new TextRun({ text: "\n3.《中国共产党党员教育管理工作条例》", font: "Arial", size: 22 }),
          new TextRun({ text: "\n4.《中国共产党纪律处分条例》", font: "Arial", size: 22 }),
          new TextRun({ text: "\n5.党的二十大报告全文", font: "Arial", size: 22 }),
          new TextRun({ text: "\n6.《榜样10》视频教学", font: "Arial", size: 22 }),
          new TextRun({ text: "\n7.《党课开讲啦—党的光辉历程》视频教学", font: "Arial", size: 22 }),
        ]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:\\Users\\zhang\\.openclaw\\workspace\\党支部理论学习考核模拟试题.docx", buffer);
  console.log("Word文档已生成：党支部理论学习考核模拟试题.docx");
});
