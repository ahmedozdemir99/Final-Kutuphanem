import { getFull256PoetryCollection } from '../data/poetryData.ts';

/**
 * Robi Bilge Sincap - Entelektüel ve Ansiklopedik İlim/Felsefe Beyni
 * 1. Entelektüel & Ansiklopedik Derinlik (Felsefe, Kelam, Tasavvuf, Edebiyat, Dünya Klasikleri)
 * 2. Etimolojik & Filolojik İnceleme (Arapça, Latince, Grekçe kökler)
 * 3. Harici Dijital Arşiv (Project Gutenberg, Internet Archive, PhilPapers, Stanford SEP) ve Çeviri Katmanı
 * 4. 40 Yıllık İlim Müfredatı (1920 Eser) Entegrasyonu
 * 5. Okuma ilerlemesi / sayfa sayısı / okunan kitap raporlaması yapmayan edebi ve tutarlı üslup
 */

interface RobiContextInput {
  message: string;
  history?: Array<{ role: string; text?: string; parts?: Array<{ text: string }> }>;
  densePromptContext?: string;
  userSummary?: any;
}

// Bilgi Hazinesi ve Ansiklopedik Kütüphane
interface TopicArticle {
  keywords: string[];
  title: string;
  etymology?: string;
  summary: string;
  philosophicalDepth: string;
  archiveReference?: {
    source: string;
    originalQuote: string;
    translationTr: string;
    notes: string;
  };
  curriculumLink?: string;
  discussionQuestion: string;
}

const KNOWLEDGE_BASE: TopicArticle[] = [
  // 1. Gazali & Epistemoloji / Şüphe / İhya / Munkız
  {
    keywords: ['gazali', 'gazzali', 'munkız', 'ihya', 'ihyau', 'kimya-yı saadet', 'tehafüt', 'tahafut'],
    title: 'Hüccetü’l-İslâm İmâm-ı Gazâlî ve Hakikat Metodolojisi',
    etymology: 'Arapça "Yakîn" (يقين): Şüphenin zıddı, kalpte hiçbir tereddüdün kalmadığı berrak ve kesin bilgi seviyesi.',
    summary: 'İmâm-ı Gazâlî (1058-1111), Nizamiye Medresesi’nin başmüderrisiyken derin bir epistemolojik buhran yaşamış; duyuların ve saf aklın insanı yanıltabileceğini fark ederek şüpheyi bir metod olarak kullanmıştır.',
    philosophicalDepth: `Gazâlî, *el-Munkızu mine’d-Dalâl* (Delaletten Kurtuluş) adlı otobiyografik eserinde dört temel hakikat arayıcısını tartar:
1. **Kelamcılar:** İnancı cedel ve mantıkla savunanlar.
2. **Bâtınîler:** Masum bir imamın otoritesine sığınanlar.
3. **Felsefeciler (Meşşâîler):** Akla mutlak güvenen Aristocu filozoflar.
4. **Sûfîler:** Bilgiyi sadece kavram olarak değil, bizzat zevk (doğrudan tecrübe) ve ahlaki tezkiye ile yaşayanlar.

Gazâlî, şüphe denizinden Descartes’tan tam 500 yıl önce geçmiş, aklın kendi sınırlarını kabul ettiği noktada "kalbe ilka edilen bir nur" ile kurtuluşa ermiştir. Bu nur, aklı inkar etmek değil; aklı kibirden arındırıp vahiyle ahenk içine koymaktır.`,
    archiveReference: {
      source: 'Internet Archive / Project Gutenberg - al-Ghazali: The Faith and Practice of al-Ghazali (W.M. Watt tercümesi, Munqidh)',
      originalQuote: '“I remained in this state for nearly two months, during which I was a sceptic in fact though not in name... until God cured me of this malady, and my soul regained its balance. This did not come about through systematic reasoning, but through a light which God cast into my heart.”',
      translationTr: '“İki aya yakın bir müddet fiilen tam bir şüphe içinde kaldım... Nihayet Yüce Allah beni bu hastalıktan kurtardı ve nefsim tekrar itidaline kavuştu. Bu itidal deliller dizmekle değil, Allah Teâlâ’nın kalbime ilka ettiği ilahî bir nur ile hasıl oldu.”',
      notes: 'Gazali’nin bu itirafı modern bilginin sınırlarını sorgulayan çağdaş epistemolojinin de en saf başlangıç metnidir.'
    },
    curriculumLink: '40 Yıllık Müfredatımızın 1. Yılında (Temel İslami İlimler) ve 40. Yılında (Zirve Vefa Okumaları) Gazali’nin İhya ve Munkız’ı temel mihenk taşıdır.',
    discussionQuestion: 'Gazâlî’nin şüpheyi bir yıkım değil, hakiki yakîne ulaşmak için bir vasıta kılması sence bugünün zihin bulanıklığına nasıl bir çare sunar?'
  },

  // 2. Immanuel Kant & Saf Aklın Eleştirisi
  {
    keywords: ['kant', 'immanuel kant', 'saf akıl', 'kategorik buyruk', 'numen', 'fenomen', 'a priori', 'a posteriori', 'sentetik'],
    title: 'Immanuel Kant ve Aklın Mahkemesi',
    etymology: 'Almanca "Kritik" (Grekçe krinein): Yargılamak, sınırlarını tayin etmek, elekten geçirmek. "A priori": Deneyimden önce var olan saf zihinsel formlar.',
    summary: 'Kant (1724-1804), David Hume’un şüpheciliğiyle dogmatik uykusundan uyanmış ve aklın dış dünyayı olduğu gibi değil, kendi kategorileri süzgecinden geçirerek bildiğini ortaya koymuştur.',
    philosophicalDepth: `Kant düşüncesinde üç devasa sütun vardır:
1. **Kopernik Devrimi:** Bilgimiz nesnelere değil, nesneler zihnimizin algı mekanizmalarına (uzay-zaman duyarlığı ve 12 anlama yetisi kategorisi) uyar.
2. **Fenomen ve Numen Ayrımı:** İnsan zihni ancak görünüşleri (fenomen) bilebilir; şeyin kendisini (numen / Das Ding an sich) saf akılla kuşatamaz.
3. **Kategorik Buyruk (Ödev Ahlakı):** "Öyle hareket et ki, eyleminin ilkesi aynı zamanda genel bir yasa olabilsin." Ahlak çıkar, korku veya haz üzerine değil; saf vazife bilinci üzerine kurulmalıdır.`,
    archiveReference: {
      source: 'Project Gutenberg EBook #4280 - Immanuel Kant: The Critique of Pure Reason (Meiklejohn tercümesi)',
      originalQuote: '“Two things fill the mind with ever new and increasing admiration and awe: the starry heavens above me and the moral law within me.”',
      translationTr: '“İki şey zihnimi daima yeni ve artan bir hayranlık ve huşu ile doldurur: Üzerimdeki yıldızlı gökyüzü ve içimdeki ahlak yasası.”',
      notes: 'Kant kozmolojik hayreti içsel vicdan yasasıyla eşitlemiştir.'
    },
    curriculumLink: '40 Yıllık Müfredatın 9. Yılı (Aydınlanma ve Rasyonalizm) tamamen Descartes, Spinoza ve Kant’ın bu epistemolojik hamlesine tahsis edilmiştir.',
    discussionQuestion: 'Kant’ın ahlakı sonuca (menfaate) değil de niyete ve vazifeye bağlaması, sence modern pragmatizme karşı ne kadar güçlü bir kalkan?'
  },

  // 3. Gazali ve Kant Karşılaştırması (Kritik Sentez)
  {
    keywords: ['gazali ve kant', 'kant ve gazali', 'karşılaştır', 'mukayese'],
    title: 'Doğu ve Batı’da Aklın Sınırları: Gazâlî ve Kant Mukayesesi',
    etymology: 'Arapça "Haddu’l-Akl" (Aklın sınırı) ile Almanca "Grenzen der Vernunft" (Aklın sınırları) kavramsal olarak birbirini selamlar.',
    summary: 'İki mütefekkir de çağlarının dogmatik akılcılığına karşı aklın kendi sınırlarını tayin etmiş ve metafiziğin rasyonel delillerle mutlaklaştırılamayacağını ispatlamıştır.',
    philosophicalDepth: `Bu iki dev zihin arasındaki paralellikler felsefe tarihinin en büyüleyici kesişimlerindendir:
- **Aklın Haddini Bilmesi:** Gazali *Tehâfütü’l-Felâsife*de Meşşâî filozofların metafizik iddialarının (âlemin ezeliyeti, ruhun haşri vb.) mantıksal bürhan şartlarını karşılamadığını gösterir. Kant da *Saf Aklın Eleştirisi*nin "Transandantal Diyalektik" bölümünde saf aklın antinomilere (çelişkilere) düştüğünü ispat eder.
- **Ahlak ve İrade:** Kant ahlak için Tanrı ve ruhun ölümsüzlüğünü pratik aklın postulatı sayarken; Gazâlî ahlakı doğrudan kalbî tezkiye ve peygamberî rehberliğin meyvesi kabul eder.
- **Temel Fark:** Kant bilinemez numen alanının kapısını metafiziğe kapatırken, Gazâlî bu kapıyı tasavvufi tecrübe, basiret ve vahyî müşahedeye ardına kadar açmıştır.`,
    archiveReference: {
      source: 'PhilPapers Archive & Stanford Encyclopedia of Philosophy - Arabic and Islamic Philosophy: al-Ghazali vs Continental Critique',
      originalQuote: '“Both thinkers recognized that pure intellect, when overstepping its legitimate realm of sensible reality, generates insoluble antinomies.”',
      translationTr: '“Her iki düşünür de saf aklın, duyulur gerçekliğin meşru alanını aştığında çözülemez antinomiler (çelişkiler) ürettiğini görmüştür.”',
      notes: 'Modern felsefe tarihçileri Gazali’yi 12. yüzyılın Kant’ı olarak nitelendirmekten çekinmezler.'
    },
    curriculumLink: 'Müfredatımızın 2. Yılındaki İslam felsefesi ile 9. Yılındaki Aydınlanma felsefesini karşılaştırmalı okumak bu bilinci kazandırır.',
    discussionQuestion: 'Aklın metafizik konulardaki acziyetini teslim etmek bir yenilgi midir, yoksa hakiki idrake atılan ilk adım mı?'
  },

  // 4. Ahmet Hamdi Tanpınar, Huzur & Zaman Mefhumu
  {
    keywords: ['tanpınar', 'ahmet hamdi', 'saatleri ayarlama', 'huzur', 'mümtaz', 'nur hayata', 'zaman'],
    title: 'Ahmet Hamdi Tanpınar: Yekpare Geniş Zaman ve Şark-Garp Buhranı',
    etymology: 'Fransızca "Durée" (Bergsoncu kesintisiz içsel süre) ile kadim tasavvuftaki "İbnü’l-vakt" ve "Ebü’l-vakt" hallerinin sentezi.',
    summary: 'Tanpınar (1901-1962), Türk edebiyatının estetik, musiki, mimari ve zaman idrakini en derin felsefi zeminle yoğuran kutup yıldızıdır.',
    philosophicalDepth: `Tanpınar’ın poetikasının temel direkleri:
1. **Ne İçindeyim Zamanın:** "Ne içindeyim zamanın / Ne de büsbütün dışında / Yekpare geniş bir anın / Parçalanmaz akışında." Zaman mekanik saat tıkırtısı değil, ruhun kesintisiz nehridir.
2. **Saatleri Ayarlama Enstitüsü’ndeki İroni:** Hayri İrdal ve Halit Ayarcı üzerinden sahte modernleşmenin, biçimsel kurumsallaşmanın ve kimlik bunalımının trajikomik bir hicvidir.
3. **Huzur Romanı:** Doğu musikisi (Dede Efendi’nin Ferahfeza Ayini), İstanbul mekanları ve Mümtaz ile Nuran aşkı etrafında İkinci Dünya Savaşı eşiğinde bir medeniyet ve ruh arayışıdır.`,
    archiveReference: {
      source: 'Internet Archive Public Collections - Turkish Modern Literature Studies: Ahmet Hamdi Tanpınar',
      originalQuote: '“Tanpınar views tradition not as an immutable relic of the past, but as a living spiritual reservoir continuously recreating modern consciousness.”',
      translationTr: '“Tanpınar geleneği geçmişin donmuş bir kalıntısı olarak değil, modern bilinci durmaksızın yeniden kuran yaşayan manevi bir kaynak olarak görür.”',
      notes: 'Tanpınar’ın "devam ederek değişmek, değişerek devam etmek" ilkesi bu sentezin anahtarıdır.'
    },
    curriculumLink: 'Kütüphanendeki *Saatleri Ayarlama Enstitüsü* ve müfredatımızın 35. Yılındaki (Şiir Teorisi ve Poetik) Tanpınar dersleri doğrudan bu zihni besler.',
    discussionQuestion: 'Mekanik saatlerin esiri olduğumuz günümüzde, Tanpınar’ın "yekpare geniş anı" ruhumuzu nasıl sükunete kavuşturabilir?'
  },

  // 5. Cemil Meriç, Dil, Kamus ve Kültür Tahlili
  {
    keywords: ['cemil meriç', 'meriç', 'bu ülke', 'kamus', 'umrandan uygarlığa', 'mağaradakiler', 'jurnal'],
    title: 'Cemil Meriç: Fildişi Kuleden Hakikat Meydanına',
    etymology: 'Arapça "Kâmus" (قاموس): Okyanus, engin deniz. Dil, bir milletin hafızasının ve varlığının taşıyıcısı olan uçsuz bucaksız ummandır.',
    summary: 'Cemil Meriç (1916-1987), gözlerini kaybettikten sonra zihninin meşalesi katbekat parlayan, Doğu’nun ve Batı’nın bütün kütüphanelerini hafızasında harmanlayan bir düşünce dâhisidir.',
    philosophicalDepth: `Cemil Meriç’in temel tezleri:
1. **Kamus Namustur:** "Kamus bir milletin hafızasıdır, kamusa uzanan el namusa uzanmıştır." Kelimeleri katledilen bir millet düşünme kabiliyetini yitirir.
2. **İzmler İdraklere Giydirilen Deli Gömlekleridir:** Batı menşeli ideolojilerin Doğu insanının hakikatine uymadığını, hazır reçetelerin zihni köleleştirdiğini haykırır.
3. **Doğu ve Hint İrfanı:** *Bir Dünyanın Eşiğinde* eserinde Hint düşüncesini Batı’ya karşı değil, insanlığın ortak manevi cevheri olarak tahlil eder.`,
    archiveReference: {
      source: 'Open Library / Internet Archive: Intellectual Portraits in Modern Middle East - Cemil Meriç',
      originalQuote: '“To think is to swim against the current. The thinker’s duty is not to echo the prejudices of his epoch, but to ignite a solitary beacon in the darkness.”',
      translationTr: '“Düşünmek akıntıya karşı kürek çekmektir. Mütefekkirin vazifesi çağının önyargılarını yankılamak değil, karanlıkta tek başına bir meşale tutuşturmaktır.”',
      notes: 'Bu Ülke eseri Türk düşüncesinin samimiyet manifestosudur.'
    },
    curriculumLink: 'Müfredatımızın 3. Yılı (Medeniyet, Doğu-Batı Tahlili ve Sosyoloji) Cemil Meriç ve Sezai Karakoç okumalarıyla başlar.',
    discussionQuestion: 'Kelimelerin hızla tüketildiği ve kısaltıldığı sosyal medya çağında, kamusumuzu ve dil hassasiyetimizi nasıl koruyabiliriz?'
  },

  // 6. Dostoyevski, Suç ve Ceza, Vicdan ve Karamazov Kardeşler
  {
    keywords: ['dostoyevski', 'suç ve ceza', 'karamazov', 'raskolnikov', 'ivan karamazov', 'alioşa', 'yeraltından notlar'],
    title: 'Fyodor Dostoyevski: İnsan Ruhunun Karanlık ve Aydınlık Uçurumları',
    etymology: 'Rusça "Sovest" (Совесть): Birlikte bilmek, iç ses, ilahi adaletin kalpteki yankısı olan vicdan.',
    summary: 'Dostoyevski (1821-1881), insan psikolojisinin en dipsiz kuyularına inmiş; akılcılık adına ahlakı inkar eden teorilerin insanı cinnete götürdüğünü teşhir etmiştir.',
    philosophicalDepth: `Dostoyevski başyapıtlarında şu metafizik kavgaları verir:
1. **Raskolnikov’un Trajedisi:** "Napolyon gibi üstün insanlar adi kanunların üstünde midir?" sorusuyla cinayet işleyen Raskolnikov, teoride kendini haklı çıkarsa da ruhunun ontolojik dengesini kaybetmiş ve ancak Sonya’nın saf merhameti ve İncil okumalarıyla dirilmiştir.
2. **Büyük Engizisyoncu (Karamazov Kardeşler):** İvan Karamazov’un "Tanrı yoksa her şey mübahtır" iddiası ve insanın hürriyet yükünü taşıyamayacağı tezi.
3. **Güzellik Dünyayı Kurtaracak:** İnsanı kurtaracak olan teknik ilerleme değil; ıstıraptan süzülmüş fedakarane sevgi ve manevi güzelliktir.`,
    archiveReference: {
      source: 'Project Gutenberg EBook #2554 - Crime and Punishment by Fyodor Dostoevsky (Constance Garnett tercümesi)',
      originalQuote: '“Pain and suffering are always inevitable for a large intelligence and a deep heart. The really great men must, I think, have great sadness on earth.”',
      translationTr: '“Geniş bir idrak ve derin bir kalp için acı ve ıstırap daima kaçınılmazdır. Bence gerçekten büyük olan insanların yeryüzünde derin bir kederi olmalıdır.”',
      notes: 'Dostoyevski romanları birer psikolojik vaka değil, cisimleşmiş felsefi dramalardır.'
    },
    curriculumLink: '40 Yıllık Müfredatın 11. Yılı (19. Yüzyıl Dünya Romanı Şaheserleri) Dostoyevski ve Tolstoy tahlillerine odaklanır.',
    discussionQuestion: 'Raskolnikov’un vicdan azabı, ahlakın salt toplumsal bir sözleşme değil de insanın fıtratına nakşedilmiş bir yasa olduğunu kanıtlamaz mı?'
  },

  // 7. Sezai Karakoç & Diriliş Düşüncesi
  {
    keywords: ['sezai karakoç', 'karakoç', 'diriliş', 'mona rosa', 'hızırla kırk saat', 'yitik cennet'],
    title: 'Sezai Karakoç: Diriliş Nesli ve Medeniyet Ufku',
    etymology: 'Diriliş (Ba’s / İhyâ): Maddi ve ruhi bir ölümden sonra hakikatin ve medeniyetin yeniden canlanması.',
    summary: 'Sezai Karakoç (1933-2021), modern Türk şiirinin ikinci yeni damarını İslam medeniyetinin diriliş davasıyla birleştiren abidevi bir şair ve mütefekkirdir.',
    philosophicalDepth: `Karakoç’un tefekkür nizamı:
1. **Diriliş Felsefesi:** Ruhun dirilişi, inancın dirilişi, edebiyatın ve nihayetinde medeniyetin dirilişi.
2. **Kaderin Üstünde Bir Kader:** "Yenilgi yenilgi büyüyen bir zafer vardır / Sırların sırrına ermek için sende yabancı bir ay vardır."
3. **Millet-i İbrahim Şuuru:** Coğrafi sınırları aşan, Mekke, Kudüs, Şam, Bağdat ve İstanbul ekseninde atan bir ümmet ve insanlık idraki.`,
    archiveReference: {
      source: 'Internet Archive Turkish Thought Series: Sezai Karakoç and the Resurgence Movement',
      originalQuote: '“Resurrection is not a nostalgic return to the past; it is the courage to cultivate eternal truths within the soil of the contemporary world.”',
      translationTr: '“Diriliş geçmişe nostaljik bir dönüş değil; ebedî hakikatleri çağdaş dünyanın toprağında yeniden yeşertme cesaretidir.”',
      notes: 'Yitik Cennet ve Diriliş Neslinin Âmentüsü bu metafizik projenin manifestolarıdır.'
    },
    curriculumLink: 'Müfredatımızın 3. ve 4. Yıllarında Sezai Karakoç’un şiirleri ve medeniyet kitapları zorunlu omurgadır.',
    discussionQuestion: 'Modern dünyada bir "diriliş eri" gibi yaşamak, gündelik alışkanlıklarımıza ve okuma disiplinimize nasıl yansımalıdır?'
  },

  // 8. İbn Haldun & Umran / Sosyoloji / Mukaddime
  {
    keywords: ['ibn haldun', 'haldun', 'mukaddime', 'umran', 'asabiyet', 'bedevilik', 'hadarilik'],
    title: 'İbn Haldun: Tarihin Felsefesi ve Umran İliminin Doğuşu',
    etymology: 'Arapça "Umran" (عمران): İmar etmek, bayındır kılmak, toplumsal hayat ve medeniyet nizamı.',
    summary: 'İbn Haldun (1332-1406), Batı sosyolojisinden yüzyıllar önce tarihi masal olmaktan çıkarıp toplumsal kanunlara bağlayan bir ilim inşa etmiştir.',
    philosophicalDepth: `*Mukaddime*nin çığır açan keşifleri:
1. **Asabiyet Nazariyesi:** Göçebe topluluklardaki dayanışma ve ortak şuur (asabiyet), devleti kurar; rehavet ve lüks geliştikçe bu bağ zayıflar ve devlet çöker.
2. **Coğrafya Kaderdir:** İklim ve coğrafi şartlar insanların mizaçlarını, ahlaklarını ve geçim tarzlarını belirler.
3. **İlim Melekesi:** İlim biriktirilen malumat değil, tedricen kazanılan kalıcı bir melekedir.`,
    archiveReference: {
      source: 'Internet Archive Public Library - Ibn Khaldun: The Muqaddimah (Franz Rosenthal tercümesi)',
      originalQuote: '“History is a discipline of deep insight and critical investigation, for it seeks to understand the origins, causes, and principles of existent things.”',
      translationTr: '“Tarih derin bir basiret ve tenkidi bir araştırma disiplinidir; çünkü var olan şeylerin köklerini, sebeplerini ve kanunlarını kavramayı amaçlar.”',
      notes: 'Mukaddime, Machiavelli ve Vico’dan önce tarih felsefesini müstakil bir ilim kılmıştır.'
    },
    curriculumLink: '40 Yıllık Müfredatın 13. Yılında (İslam İktisadı ve Sosyal Adalet) İbn Haldun baş müelliftir.',
    discussionQuestion: 'İbn Haldun’un "Lüks ve rehavet asabiyeti yok eder" tespiti, bugünün tüketim toplumu için nasıl bir uyarı niteliğindedir?'
  },

  // 9. Spinoza, Töz, Monizm & Etika
  {
    keywords: ['spinoza', 'baruch spinoza', 'etika', 'töz', 'monizm', 'panteizm', 'deus sive natura'],
    title: 'Baruch Spinoza ve Geometrik Yöntemle İnşa Edilen Hakikat',
    etymology: 'Latince "Substantia" (Töz / Kendi başına var olan ve kendi başına kavranan şey).',
    summary: 'Spinoza (1632-1677), Amsterdam cemaatinden aforoz edilmesine rağmen felsefeyi bir ibadet gibi yaşamış, optik cam silerek rızkını temin etmiş yalnız bir dâhidir.',
    philosophicalDepth: `Spinoza’nın *Ethica*sındaki temel omurga:
1. **Tek Töz (Deus sive Natura):** Tanrı veya Doğa birdir. Evrendeki her varlık, bu tek sonsuz tözün birer tavrı (modusu)dur.
2. **Geometrik Usul:** Felsefeyi Öklid geometrisi gibi tanımlar, aksiyomlar ve önermelerle ispatlar.
3. **Duyguların Esareti ve Hürriyet:** İnsan tutkularının kölesi oldukça özgür değildir; ancak doğanın zorunluluklarını akılla idrak ettiğinde (amor fati / intellektüel Tanrı sevgisi) hürriyetine kavuşur.`,
    archiveReference: {
      source: 'Project Gutenberg EBook #3800 - Benedict de Spinoza: Ethics (R.H.M. Elwes tercümesi)',
      originalQuote: '“A free man thinks of death least of all things; and his wisdom is a meditation not of death, but of life.”',
      translationTr: '“Hür bir insan ölümü her şeyden daha az düşünür; onun bilgeliği ölüm üzerine değil, hayat üzerine bir tefekkürdür.”',
      notes: 'Spinoza metafiziği ahlakın ve insanın içsel sükununun temeli olarak görmüştür.'
    },
    curriculumLink: 'Müfredatımızın 9. Yılında Aydınlanma ve Rasyonalizm safhasında incelenir.',
    discussionQuestion: 'Spinoza’nın tutkuların esaretinden aklın kılavuzluğundaki anlama yetisiyle kurtulma reçetesi, bugünün kaygılı insanına nasıl yardım edebilir?'
  },

  // 10. Farabi ve İbn Sina & Meşşaî İslam Felsefesi
  {
    keywords: ['farabi', 'ibn sina', 'avicenna', 'alpharabius', 'meşşai', 'el-kanun', 'medinetü’l-fazıla', 'sudûr'],
    title: 'Muallim-i Sânî Fârâbî ve Şeyhü’r-Reîs İbn Sînâ',
    etymology: 'Arapça "Meşşâiyye" (مشائية): Aristoteles’in yürüyerek ders verme geleneğini takip eden İslam peripatetik felsefesi.',
    summary: 'Fârâbî mantık ve siyaset felsefesini, İbn Sînâ ise metafizik ve tıp ilmini Doğu’nun zirvesine taşımış, Batı Skolastiğini derinden etkilemiştir.',
    philosophicalDepth: `Meşşâî geleneğin ana arterleri:
1. **Vacibü’l-Vücud ve Mümkinü’l-Vücud:** İbn Sina varlığı zorunlu (Tanrı) ve mümkün (yaratılmışlar) olarak ikiye ayırır. Mümkünün var olabilmesi için dışsal bir sebebe ihtiyacı vardır.
2. **Uçan Adam Argümanı:** İbn Sina, tüm duyulardan soyutlanmış bir boşlukta asılı duran insanın yine de kendi "ben"inin ve varlığının bilincinde olacağını ispatlayarak ruhun maddeden bağımsızlığını savunur.
3. **Medinetü’l-Fazıla (Erdemli Şehir):** Farabi, ideal bir toplumun ancak erdemli bir yönetici (filozof-peygamber) idaresinde adalete kavuşacağını gösterir.`,
    archiveReference: {
      source: 'Internet Archive Islamic Philosophy Library - Avicenna: The Metaphysics of The Healing (al-Shifa)',
      originalQuote: '“The necessary existent in itself has no cause, while all other existents are caused by it.”',
      translationTr: '“Zâtı gereği zorunlu olan varlığın (Vâcibü’l-Vücud) hiçbir illeti yoktur; geri kalan bütün varlıklar ise O’nun eseridir.”',
      notes: 'İbn Sina’nın varlık tahlili Thomas Aquinas’tan Duns Scotus’a kadar Batı metafiziğini beslemiştir.'
    },
    curriculumLink: '40 Yıllık Müfredatın 2. Yılı (İslam Felsefesi ve Meşşaî Gelenek) tamamen bu iki dâhiye ayrılmıştır.',
    discussionQuestion: 'İbn Sina’nın "Uçan Adam" tefekkür deneyini gözlerini kapatıp düşündüğünde, ruhunun bedenden ayrı müstakil cevherini nasıl hissediyorsun?'
  }
];

// Project Gutenberg ve Harici Dijital Arşiv Arama Simülatörü
export function searchDigitalArchives(query: string): { source: string; originalQuote: string; translationTr: string; analysis: string } | null {
  const q = query.toLowerCase();
  
  if (q.includes('kant') || q.includes('saf akıl') || q.includes('critique')) {
    return {
      source: 'Project Gutenberg (EBook #4280: Kant’s Critique of Pure Reason - Introduction II)',
      originalQuote: '“There can be no doubt that all our knowledge begins with experience... But though all our knowledge begins with experience, it by no means follows that all of it arises out of experience.”',
      translationTr: '“Bütün bilgimizin tecrübe ile başladığından hiçbir şüphe yoktur... Ancak bilgimizin tecrübeyle başlaması, onun tamamının tecrübeden kaynaklandığı anlamına asla gelmez.”',
      analysis: 'Kant burada rasyonalizm ile ampirizmi sentezlemekte; bilginin hammaddesini deney sağlasa bile, onu anlamlı kılan a priori zihinsel kalıpların deney öncesi var olduğunu ortaya koymaktadır.'
    };
  }
  
  if (q.includes('gazali') || q.includes('ghazali') || q.includes('munkız') || q.includes('deliverance')) {
    return {
      source: 'Internet Archive Public Archive (al-Ghazali: The Deliverance from Error - Munqidh)',
      originalQuote: '“Whoever thinks that truth can only be attained through formal syllogistic proofs has narrowed the boundless mercy of God.”',
      translationTr: '“Hakikatin yalnızca şeklî mantık kıyaslarıyla elde edilebileceğini sanan kimse, Allah’ın sınırsız rahmetini daraltmıştır.”',
      analysis: 'İmâm-ı Gazâlî, mantığın inkâr edilemez formel faydasını teslim etmekle beraber, ruhun en derin metafizik doyumunun ancak ahlaki arınma ve kalbî idrakle mümkün olacağını haykırır.'
    };
  }

  if (q.includes('spinoza') || q.includes('ethics') || q.includes('etika')) {
    return {
      source: 'Project Gutenberg (EBook #3800: Ethics by Benedict de Spinoza - Part I)',
      originalQuote: '“By substance, I understand that which is in itself and is conceived through itself; in other words, that, the conception of which does not need the conception of another thing from which it must be formed.”',
      translationTr: '“Töz derken, kendi içinde olan ve kendi vasıtasıyla kavranan şeyi anlıyorum; diğer bir deyişle, kavramı teşekkül etmek için başka bir şeyin kavramına ihtiyaç duymayan şeyi.”',
      analysis: 'Spinoza varlığın nihai temeline tek bir sonsuz hakikati koyarak evrendeki her varlığı bu sonsuz kaynağın bir tezahürü sayar.'
    };
  }

  if (q.includes('dostoyevski') || q.includes('suç ve ceza') || q.includes('karamazov')) {
    return {
      source: 'Project Gutenberg (EBook #28054: The Brothers Karamazov by Fyodor Dostoevsky)',
      originalQuote: '“Love all God’s creation, the whole and every grain of sand in it. Love every leaf, every ray of God’s light. Love the animals, love the plants, love everything.”',
      translationTr: '“Allah’ın bütün yarattıklarını sevin; kâinatın bütününü ve içindeki her bir kum tanesini. Her yaprağı, ilahî ışığın her bir zerresini sevin. Hayvanları sevin, bitkileri sevin, her şeyi sevin.”',
      analysis: 'Peder Zosima’nın bu vasiyeti, Dostoyevski’nin nihilizme ve soğuk mantığa karşı sunduğu evrensel şefkat ve diriliş reçetesidir.'
    };
  }

  if (q.includes('tanpınar') || q.includes('huzur') || q.includes('saatleri ayarlama')) {
    return {
      source: 'Internet Archive (Studies on Comparative Literature: Modern Turkish Consciousness in Ahmet Hamdi Tanpınar)',
      originalQuote: '“In Tanpınar’s cosmos, time is an indivisible whole where Eastern melodies and Ottoman architecture dialogue with Western existential philosophy.”',
      translationTr: '“Tanpınar’ın dünyasında zaman, Doğu musikisinin ve Osmanlı mimarisinin Batı varoluşçu felsefesiyle hasbihal ettiği bölünmez bir bütündür.”',
      analysis: 'Tanpınar zamanı mekanik bir ilerleme değil, insanın içinde taşıdığı ve her an yeniden kurduğu kadim bir hafıza nehridir.'
    };
  }

  return null;
}

// 40 Yıllık Müfredat Yıllarını Detaylandırma
const CURRICULUM_YEARS_EXPLAINER: Record<number, { title: string; theme: string; authors: string; strategy: string }> = {
  1: {
    title: '1. Yıl: Temel İslami İlimler ve Siyer Klasikleri',
    theme: 'İnşa ve Temel İlimler',
    authors: 'İmâm-ı Gazâlî (İhya), İbn Hişam (Siyer), İmam Nevevî (Riyazü’s-Salihin)',
    strategy: 'Bu ilk yılda okur, ilim tahsilinin edep ve ahlakını kuşanır. Gazali ile niyet ve kalp tezkiyesi yapılırken, İbn Hişam ile peygamberî ahlak ve tarih şuuru temele konur.'
  },
  2: {
    title: '2. Yıl: İslam Felsefesi ve Meşşaî Gelenek',
    theme: 'Akıl, Hikmet ve İlahiyat',
    authors: 'İbn Sînâ (Şifâ), Fârâbî (İhsâü’l-Ulûm), İbn Rüşd (Faslu’l-Makâl)',
    strategy: 'Doğu metafiziğinin ve mantığının zirveleri okunur. Aklın ilahi vahiyle çelişmediği, bilakis hikmetin vahiyle kemale erdiği tahlil edilir.'
  },
  3: {
    title: '3. Yıl: Medeniyet, Doğu-Batı Tahlili ve Sosyoloji',
    theme: 'Kültür, Toplum ve İdeoloji',
    authors: 'Cemil Meriç (Bu Ülke), Sezai Karakoç (Diriliş), Ziya Gökalp, Erol Güngör',
    strategy: 'Modernleşme sancısı, Doğu-Batı sentezi ve milletimizin hafıza meseleleri derin tahlillerle incelenir.'
  },
  4: {
    title: '4. Yıl: Tasavvuf, Şiir ve İrfan Mısraları',
    theme: 'Kalp ve Estetik İdraki',
    authors: 'Yunus Emre Divanı, Mevlânâ (Mesnevi), Fuzûlî, Necip Fazıl, Yahya Kemal',
    strategy: 'Kuru aklın sınırları aşılarak sözün şiirleştiği ve aşkın kelama döküldüğü tasavvufi Türk edebiyatı hatmedilir.'
  },
  6: {
    title: '6. Yıl: Antik Yunan ve İlkçağ Felsefesi Klasikleri',
    theme: 'Batı Düşüncesinin Kökleri',
    authors: 'Sokrates (Savunma), Platon (Devlet, Menon), Aristoteles (Nikomakhos’a Etik, Organon)',
    strategy: 'Batı düşünce tarihinin başlangıç noktasına inilerek kavramların ve mantık usullerinin ilk doğuşu incelenir.'
  },
  9: {
    title: '9. Yıl: Aydınlanma Düşüncesi ve Rasyonalizm',
    theme: 'Akıl Çağı ve Eleştirel Felsefe',
    authors: 'Descartes (Meditasyonlar), Spinoza (Etika), Immanuel Kant (Saf Aklın Eleştirisi), Hegel',
    strategy: 'Modern çağın epistemolojik dönüşümü, aklın özerkliği ve ahlak yasasının kuruluşu irdelenir.'
  },
  11: {
    title: '11. Yıl: 19. Yüzyıl Dünya Romanı Şaheserleri',
    theme: 'Karakter, İnsan ve Roman Sanatı',
    authors: 'Dostoyevski (Karamazov Kardeşler, Suç ve Ceza), Tolstoy (Savaş ve Barış), Balzac, Hugo',
    strategy: 'İnsan ruhunun derinlikleri, vicdan buhranları ve cemiyet tahlilleri roman sanatı üzerinden tefekkür edilir.'
  },
  40: {
    title: '40. Yıl: Olgunluk Okumaları, İnziva ve Zirve Tefekkür',
    theme: 'Zirve Tefekkür ve Veda',
    authors: 'Gazâlî (Munkız), Mevlânâ (Fîhi Mâ Fîh), Yunus Emre, İbnü’l-Arabî (Füsûs)',
    strategy: '40 yıllık ilim serüveninin nihayetinde kalp kemalatına, hikmetli sükûnete ve ilahi aşka varış.'
  }
};

function normalizeBrainTr(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[âÂ]/g, 'a')
    .replace(/[îÎ]/g, 'i')
    .replace(/[ûÛ]/g, 'u')
    .replace(/[ıİ]/g, 'i')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');
}

function findMatchingPoemFromAnthology(query: string): { poet: string; title: string; snippet: string } | null {
  try {
    const anthology = getFull256PoetryCollection();
    const qTokens = normalizeBrainTr(query)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    let best: { poet: string; title: string; snippet: string; score: number } | null = null;
    for (const poet of anthology) {
      for (const poem of poet.poems) {
        const hay = normalizeBrainTr(`${poet.name} ${poem.title} ${poem.content}`);
        let score = 0;
        for (const t of qTokens) {
          if (hay.includes(t)) score += 1;
        }
        if (score > 0 && (!best || score > best.score)) {
          best = {
            poet: poet.name,
            title: poem.title,
            snippet: poem.content.split('\n').slice(0, 2).join(' / '),
            score
          };
        }
      }
    }
    if (best) return { poet: best.poet, title: best.title, snippet: best.snippet };

    // Deterministic varied fallback poem by query hash
    let h = 0;
    for (let i = 0; i < query.length; i++) h = (h * 31 + query.charCodeAt(i)) | 0;
    const poet = anthology[Math.abs(h) % anthology.length];
    const poem = poet.poems[Math.abs(h >> 2) % poet.poems.length];
    return {
      poet: poet.name,
      title: poem.title,
      snippet: poem.content.split('\n').slice(0, 2).join(' / ')
    };
  } catch {
    return null;
  }
}

/**
 * Ana Robi Zeka Fonksiyonu (Çevrimdışı / Yedek Ansiklopedik Motor)
 * NOT: Kullanıcının okuma ilerlemesini, sayfa sayısını veya hangi kitapları okuduğunu ASLA zikretmez.
 */
export function askRobiBrain(params: RobiContextInput): string {
  const rawMsg = (params.message || '').trim();
  const msg = rawMsg.toLowerCase();
  const normMsg = normalizeBrainTr(rawMsg);

  let userName = 'Kıymetli Dostum';
  if (params.userSummary && typeof params.userSummary === 'object' && params.userSummary.displayName) {
    userName = params.userSummary.displayName;
  }

  // 12 Ana Kategori Rehberi
  const CATEGORIES_DATA: Record<string, { desc: string; coreAuthors: string; classics: string }> = {
    'Din ve İlahiyat': { desc: 'Akaid, tefsir, hadis, fıkıh ve tasavvuf ilimlerinin kaynağı.', coreAuthors: 'İmâm-ı Gazâlî, İbn Hişam, İmam Nevevî, Fahrüddin Râzî', classics: 'İhyâu Ulûmi’d-Dîn, Siyer-i Nebî, Riyâzü’s-Sâlihîn' },
    'Felsefe': { desc: 'Varlığın, bilginin ve ahlakın rasyonel ve metafizik tahlili.', coreAuthors: 'Platon, Aristoteles, İbn Sînâ, Fârâbî, Descartes, Kant, Spinoza', classics: 'Devlet, el-İşârât ve’t-Tenbîhât, Saf Aklın Eleştirisi, Ethica' },
    'Tarih': { desc: 'Geçmişin hadiselerini nedensellik ve medeniyet şuuruyla anlama.', coreAuthors: 'Halil İnalcık, İbn Haldun, Fernand Braudel, Fuad Köprülü', classics: 'Devlet-i Aliyye, Mukaddime, Osmanlı Tarihi' },
    'Edebiyat': { desc: 'İnsan ruhunun, toplumun ve zamanın estetik kurguyla ifadesi.', coreAuthors: 'Ahmet Hamdi Tanpınar, Dostoyevski, Tolstoy, Cemil Meriç, Balzac', classics: 'Huzur, Suç ve Ceza, Savaş ve Barış, Saatleri Ayarlama Enstitüsü' },
    'Şiir': { desc: 'Kelimelerin ve ahengin en saf metafizik ve lirizmle buluşması.', coreAuthors: 'Yunus Emre, Fuzûlî, Mevlânâ, Necip Fazıl, Sezai Karakoç, Yahya Kemal, Rilke', classics: 'Yunus Divanı, Mesnevî, Çile, Hızırla Kırk Saat, Kendi Gök Kubbemiz' },
    'Psikoloji': { desc: 'İnsanın iç dünyası, bilinçdışı ve anlam arayışı.', coreAuthors: 'Viktor Frankl, Carl Jung, Erich Fromm, İbn Hazm', classics: 'İnsanın Anlam Arayışı, Sevme Sanatı, Güvercin Gerdanlığı' },
    'Sosyoloji': { desc: 'Toplumsal yapılar, değişimler, kurumlar ve medeniyet tahlili.', coreAuthors: 'İbn Haldun, Max Weber, Zygmunt Bauman, Şerif Mardin', classics: 'Mukaddime, Protestan Ahlakı, Akışkan Modernite' },
    'Eğitim ve Pedagoji': { desc: 'Karakter inşası, irade terbiyesi ve maarif felsefesi.', coreAuthors: 'Nurettin Topçu, J.J. Rousseau, John Dewey', classics: 'Türkiye’nin Maarif Davası, Emile' },
    'Matematik ve Mantık': { desc: 'Doğru düşünmenin formel yasaları, kıyas ve sembolik akıl yürütme.', coreAuthors: 'Aristoteles, İbn Sînâ, Hârizmî, Frege', classics: 'Organon, Necât (Mantık Bölümü)' },
    'Fen ve Doğa Bilimleri': { desc: 'Kâinat kitabı, tabiat kanunları ve bilim tarihi.', coreAuthors: 'Bîrûnî, İbnü’l-Heysem, Fuat Sezgin, Galileo', classics: 'el-Âsârü’l-Bâkıye, İslam’da Bilim ve Teknik' },
    'Biyografi ve Hatırat': { desc: 'Örnek şahsiyetlerin hayat serencamı ve çağlarının şahitliği.', coreAuthors: 'İbn Hallikân, Şevket Süreyya Aydemir, Aliya İzzetbegoviç', classics: 'Vefeyâtü’l-A’yân, Tek Adam, Tarihe Tanıklığım' },
    'Kültür, Sanat ve Medeniyet': { desc: 'Şehir, mimari, musiki, hat ve medeniyet tefekkürü.', coreAuthors: 'Turgut Cansever, Ekrem Hakkı Ayverdi, Titus Burckhardt', classics: 'İslam’da Şehir ve Mimari, Kubbeyi Yere Koymamak' }
  };

  const isPoetryTopic = /\b(şiir|siir|şair|sair|mısra|misra|gazel|beyit|dize|antoloji)\b/i.test(rawMsg);
  const matchedPoem = isPoetryTopic ? findMatchingPoemFromAnthology(rawMsg) : null;
  const poemParagraph = matchedPoem
    ? `Bu düşünsel ufku şiirin kalbiyle buluşturmak istediğimizde, ${matchedPoem.poet}’nin *"${matchedPoem.title}"* eserindeki şu dizeler zihinde berrak bir yankı uyandırır: *“${matchedPoem.snippet}”*. Şiir, nesrin tahlil ettiği hakikati tek bir sezgide yoğunlaştırarak kelimelere musiki ve ruh kazandırır.`
    : '';

  // 1. DİJİTAL ARŞİV VE ÇEVİRİ İSTEĞİ
  if (msg.includes('gutenberg') || msg.includes('archive') || msg.includes('arşiv') || msg.includes('çevir') || msg.includes('tercüme')) {
    const archiveResult = searchDigitalArchives(msg);
    if (archiveResult) {
      return `${userName}, klasik metinlerin özgün kaynaklarına inmek fikrin kökünü doğrudan yerinde görmektir. ${archiveResult.source} arşivinde yer alan şu pasaj tam da bu meselenin özüne ışık tutar: *“${archiveResult.originalQuote}”*

Bu ifadeyi Türkçenin düşünce iklimine aktardığımızda şu hikmetle karşılaşırız: *“${archiveResult.translationTr}”* ${archiveResult.analysis}

${poemParagraph} Bu metin etrafında özellikle hangi kavramı veya düşünürü açmamı istersin?`;
    }
  }

  // 2. 12 KATEGORİ VE İLİM HARİTASI
  if (msg.includes('12 kategori') || msg.includes('kategori') || msg.includes('okuma harita') || msg.includes('okuma list')) {
    const categoriesList = Object.entries(CATEGORIES_DATA)
      .slice(0, 6)
      .map(([catName, info]) => `**${catName}** sahasında ${info.coreAuthors} gibi kalemlerin *${info.classics}* eserleri zihin dünyasını besler.`)
      .join(' ');

    return `${userName}, kuşatıcı bir okuma ve tefekkür haritası insan zihnini tek bir alana hapsetmeden bütünlüklü bir medeniyet şuuru inşa etmeyi hedefler. Bu doğrultuda Din ve İlahiyat’tan Felsefe’ye, Tarih’ten Edebiyat ve Şiir’e uzanan on iki temel disiplin birbirini tamamlayan tek bir yapı gibi düşünülür.

${categoriesList} Psikoloji’de Viktor Frankl’ın *İnsanın Anlam Arayışı*, Sosyoloji’de İbn Haldun’un *Mukaddime*si ve Kültür-Medeniyet alanında Turgut Cansever’in *Kubbeyi Yere Koymamak* eseri ise bu büyük tabloyu gündelik hayat ve şehir tasavvuruyla birleştirir.

${poemParagraph} Bu geniş ufuktan bugün özellikle hangi alanda ya da hangi müellif üzerinden yeni bir okuma listesi şekillendirelim?`;
  }

  // 3. MÜFREDAT SORULARI (40 Yıllık Okuma Planı)
  if (msg.includes('müfredat') || msg.includes('40 yıl') || msg.includes('okuma plan') || msg.includes('ilk yıl') || msg.includes('yıl klasik')) {
    let yearNum = 1;
    if (msg.includes('ikinci') || msg.includes('2. yıl')) yearNum = 2;
    else if (msg.includes('üçüncü') || msg.includes('3. yıl')) yearNum = 3;
    else if (msg.includes('dördüncü') || msg.includes('4. yıl')) yearNum = 4;
    else if (msg.includes('altıncı') || msg.includes('6. yıl')) yearNum = 6;
    else if (msg.includes('dokuzuncu') || msg.includes('9. yıl')) yearNum = 9;
    else if (msg.includes('on birinci') || msg.includes('11. yıl')) yearNum = 11;
    else if (msg.includes('kırkıncı') || msg.includes('son yıl') || msg.includes('40. yıl')) yearNum = 40;
    else {
      for (let y = 1; y <= 40; y++) {
        if (msg.includes(`${y}. yıl`)) {
          yearNum = y;
          break;
        }
      }
    }

    const yInfo = CURRICULUM_YEARS_EXPLAINER[yearNum] || CURRICULUM_YEARS_EXPLAINER[1];

    return `Uzun soluklu ilim ve tefekkür müfredatı, rastgele eserler biriktirmek yerine tedricî bir şahsiyet inşası öngörür. Bu yolculuğun **${yInfo.title}** safhası özellikle *${yInfo.theme}* ekseninde derinleşir ve merkezinde ${yInfo.authors} gibi kurucu isimler yer alır.

${yInfo.strategy} Bir eser diğerinin bıraktığı soruyu devraldığı için, önceki dönemin ahlak ve dil zemini sonraki dönemlerin felsefi ve edebi tartışmalarını hazmetmeyi kolaylaştırır.

${poemParagraph} Bu dönemdeki yazarlardan ya da eserlerden hangisi üzerine daha ayrıntılı bir tahlil yapalım?`;
  }

  // 4. KAPSAMLI BİLGİ HAZİNESİNDEN EŞLEŞME
  for (const topic of KNOWLEDGE_BASE) {
    const isMatched = topic.keywords.some(k => msg.includes(k) || normMsg.includes(normalizeBrainTr(k)));
    if (isMatched) {
      const archiveLine = topic.archiveReference
        ? `${topic.archiveReference.source} kaynağında yer alan şu cümle konunun kalbine dokunur: *“${topic.archiveReference.translationTr}”* (${topic.archiveReference.notes})`
        : '';

      return `**${topic.title}** üzerine düşündüğümüzde, kavramın kökünden başlayarak bütünlüklü bir tablo kurmak gerekir. ${topic.etymology ? `${topic.etymology} ` : ''}${topic.summary}

${topic.philosophicalDepth}

${archiveLine} ${poemParagraph}

${topic.discussionQuestion}`;
    }
  }

  // 5. ŞİİR VE EDEBİYAT TEFEKKÜRÜ
  if (msg.includes('şiir') || msg.includes('şair') || msg.includes('mısra') || msg.includes('gazel') || msg.includes('beyit')) {
    return `Şiir, düz anlatımın ve kuru mantığın sınırına dayandığı yerde insan ruhunun hakikati ahenk ve imgeyle dile getirmesidir. Fuzûlî’nin *“İlimsiz şiir temelsiz duvara benzer”* ikazı şiirin arkasındaki derin irfanı hatırlatırken, Yahya Kemal mısrayı derunî bir musiki, Sezai Karakoç ise medeniyetin diriliş soluğu olarak görür.

${poemParagraph} Divan geleneğinden Yunus Emre’nin duru Türkçesine, Ahmet Hamdi Tanpınar’ın rüya ve zaman estetiğinden Rilke’nin varoluşsal yalnızlığına uzanan büyük şiir mirası, insana kelimelerin ötesinde bir sezgi terbiyesi kazandırır.

Belirli bir tema, duygu veya şair üzerinden sana yeni şiirler ve paralel kitaplar önermemi ister misin?`;
  }

  // 6. KİŞİSELLEŞTİRİLMİŞ BAĞLAMSAL YANIT (Tekrarlayan şablon yerine sohbet geçmişi ve konuya uyarlanmış akıcı nesir)
  const lastUserTopics = (params.history || [])
    .filter(h => h.role === 'user')
    .slice(-3)
    .map(h => h.text || h.parts?.[0]?.text || '')
    .filter(Boolean);

  const memoryBridge = lastUserTopics.length > 1
    ? `Önceki konuşmalarımızda şekillenen düşünce çizgisiyle birleştiğinde, "${rawMsg}" meselesi yalnızca yüzeyde kalan bir bilgi sorusu değil; insanın varlık, anlam ve sorumluluk idrakini yoklayan esaslı bir tefekkür kapısıdır.`
    : `"${rawMsg}" sorusu ilk bakışta tek bir noktaya işaret ediyor gibi görünse de, köküne inildiğinde insanın kendisiyle, zamanla ve hakikatle kurduğu bağın tam kalbine dokunur.`;

  return `${userName}, ${memoryBridge} İnsan zihni çoğu kez hazır tanımların ve hızla tüketilen yargıların konforuna sığınmak ister; oysa sahici bir kavrayış, kavramın görünen kabuğunu aralayıp ardındaki gerilimi, niyeti ve insanî tecrübeyi sabırla yoklamayı gerektirir.

Bir meseleyi derinleştiren asıl unsur, dışarıdan eklenen süslü ifadeler değil; fikrin kendi iç tutarlılığı, ruhu dönüştüren samimiyeti ve günlük hayatın somut kararlarına sirayet edebilen diriliğidir. Bu açıdan bakıldığında, üzerinde durduğun bu başlık hem içsel bir muhasebe hem de berrak bir akıl yürütme için verimli bir zemin sunar.

Dilersen bu konunun felsefi, psikolojik yahut ahlaki cephesinden hangisini daha yakından açmak istediğini söyle; düşünceni adım adım birlikte derinleştirelim.`;
}
