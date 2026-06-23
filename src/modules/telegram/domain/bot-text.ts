export enum BotLanguage {
  Ru = 'ru',
  Kk = 'kk',
}

export type BotTextKey =
  | 'chooseLanguage'
  | 'fullNamePrompt'
  | 'phonePrompt'
  | 'sharePhone'
  | 'mainMenuTitle'
  | 'newReport'
  | 'myReports'
  | 'changeLanguage'
  | 'helpButton'
  | 'help'
  | 'sendPhoto'
  | 'photoAdded'
  | 'next'
  | 'cancel'
  | 'sendLocation'
  | 'shareLocation'
  | 'enterAddress'
  | 'descriptionPrompt'
  | 'skip'
  | 'confirmReport'
  | 'editLocation'
  | 'editDescription'
  | 'addPhoto'
  | 'submit'
  | 'reportCancelled'
  | 'needPhoto'
  | 'tooManyPhotos'
  | 'savedProfile';

const messages: Record<BotLanguage, Record<BotTextKey, string>> = {
  [BotLanguage.Ru]: {
    chooseLanguage:
      'Сәлеметсіз бе! / Здравствуйте!\n\nВыберите язык / Тілді таңдаңыз:',
    fullNamePrompt: 'Введите ваше ФИО.\nНапример: Иванов Иван Иванович',
    phonePrompt:
      'Отправьте ваш номер телефона.\nНажмите кнопку ниже или введите номер вручную.',
    sharePhone: '📱 Отправить номер телефона',
    mainMenuTitle: 'Главное меню',
    newReport: '🗑 Создать обращение',
    myReports: '📄 Мои обращения',
    changeLanguage: '🌐 Изменить язык',
    helpButton: 'ℹ️ Помощь',
    help: 'С помощью этого бота вы можете отправить обращение о мусоре или незаконной свалке.\n\nДля обращения нужно:\n1. Отправить фото.\n2. Указать геопозицию или адрес.\n3. Добавить описание.\n4. Подтвердить отправку.\n\nПосле отправки вы получите номер обращения.',
    sendPhoto:
      'Отправьте фото мусора или незаконной свалки.\nМожно отправить одно или несколько фото.',
    photoAdded:
      'Фото добавлено.\nВы можете отправить ещё фото или нажать "Далее".',
    next: '➡️ Далее',
    cancel: '❌ Отменить',
    sendLocation:
      'Теперь отправьте геопозицию места, где находится мусор.\n\nЕсли вы уже не на месте, можете ввести адрес текстом.',
    shareLocation: '📍 Отправить геопозицию',
    enterAddress: '✍️ Ввести адрес текстом',
    descriptionPrompt:
      'Добавьте короткое описание проблемы.\n\nНапример:\n"Незаконная свалка возле дороги, мусор лежит несколько недель."',
    skip: 'Пропустить',
    confirmReport: 'Проверьте обращение:',
    editLocation: '✏️ Изменить место',
    editDescription: '📝 Изменить описание',
    addPhoto: '🖼 Добавить фото',
    submit: '✅ Отправить',
    reportCancelled: 'Создание обращения отменено.',
    needPhoto: 'Сначала отправьте хотя бы одно фото.',
    tooManyPhotos: 'Для одного обращения можно добавить максимум 5 фото.',
    savedProfile: 'Профиль сохранён.',
  },
  [BotLanguage.Kk]: {
    chooseLanguage:
      'Сәлеметсіз бе! / Здравствуйте!\n\nВыберите язык / Тілді таңдаңыз:',
    fullNamePrompt: 'Толық аты-жөніңізді енгізіңіз.',
    phonePrompt:
      'Телефон нөміріңізді жіберіңіз.\nТөмендегі батырманы басуға немесе қолмен енгізуге болады.',
    sharePhone: '📱 Телефон нөмірін жіберу',
    mainMenuTitle: 'Басты мәзір',
    newReport: '🗑 Өтініш жасау',
    myReports: '📄 Менің өтініштерім',
    changeLanguage: '🌐 Тілді өзгерту',
    helpButton: 'ℹ️ Көмек',
    help: 'Бұл бот арқылы қоқыс немесе заңсыз қоқыс орны туралы өтініш жібере аласыз.\n\nӨтініш үшін:\n1. Фото жіберіңіз.\n2. Геопозиция немесе мекенжай көрсетіңіз.\n3. Сипаттама қосыңыз.\n4. Жіберуді растаңыз.\n\nЖібергеннен кейін өтініш нөмірін аласыз.',
    sendPhoto:
      'Қоқыс немесе заңсыз қоқыс орнының фотосын жіберіңіз.\nБір немесе бірнеше фото жіберуге болады.',
    photoAdded:
      'Фото қосылды.\nТағы фото жіберіңіз немесе "Келесі" батырмасын басыңыз.',
    next: '➡️ Келесі',
    cancel: '❌ Болдырмау',
    sendLocation:
      'Енді қоқыс тұрған жердің геопозициясын жіберіңіз.\n\nЕгер сол жерде болмасаңыз, мекенжайды мәтінмен енгізіңіз.',
    shareLocation: '📍 Геопозиция жіберу',
    enterAddress: '✍️ Мекенжайды мәтінмен енгізу',
    descriptionPrompt: 'Мәселенің қысқаша сипаттамасын қосыңыз.',
    skip: 'Өткізу',
    confirmReport: 'Өтінішті тексеріңіз:',
    editLocation: '✏️ Орынды өзгерту',
    editDescription: '📝 Сипаттаманы өзгерту',
    addPhoto: '🖼 Фото қосу',
    submit: '✅ Жіберу',
    reportCancelled: 'Өтініш жасау тоқтатылды.',
    needPhoto: 'Алдымен кемінде бір фото жіберіңіз.',
    tooManyPhotos: 'Бір өтінішке ең көбі 5 фото қосуға болады.',
    savedProfile: 'Профиль сақталды.',
  },
};

export const t = (
  language: BotLanguage | string | null | undefined,
  key: BotTextKey,
) => {
  const selectedLanguage =
    language === BotLanguage.Kk ? BotLanguage.Kk : BotLanguage.Ru;

  return messages[selectedLanguage][key];
};
