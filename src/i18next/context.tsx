import i18next from 'i18next';
import {
    Accessor,
    Component,
    createContext,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    For,
    type JSX,
    onCleanup,
    onMount,
    ParentProps,
    type Resource,
    useContext
} from 'solid-js';
import { createStore, unwrap } from "solid-js/store";
import HttpApi from 'i18next-http-backend';

export type Language = {
    id: number
    code: string
    name: string
}

export type ProjectInfo = {
    id: number
    name: string
    sourceLanguage: Language
    targetLanguages: Language[]
    namespaces: string[]
}

export type I18NextContextProps = ParentProps<{
    projectId: string
    apiKey: string
    host?: string
    debug?: boolean
}>

type ResourceRequest = {
    resourceType: 'init' | 'change_language' | 'namespace'
    resourceId?: string | string[] | null
}

type LanguageId = string
type NamespaceId = string

type LoadedResources = Record<LanguageId, Record<NamespaceId, boolean>>;


export type I18NextContext = {
    loading: Accessor<boolean>

    /**
     * List of languages available in the project.
     */
    languages: Accessor<Language[]>
    currentLanguage: Accessor<string | null>
    changeLanguage: (langCode: string) => Promise<void>
    loadedSignal: Accessor<LoadedResources>
    loadNamespace: (ns: string | string[]) => Promise<void>

    /**
     * Actual i18next instance being used by the context.
     */
    i18next: typeof i18next

    /**
     * Loads the raw JSON translation data for a given language and namespace.
     */
    loadRawJson: (langCode: string, ns: string) => Promise<Record<string, any>>
}

const Context = createContext<I18NextContext>();

const getInitialLanguage = (supportedLanguages: Language[]) => {
    // get the user's preferred languages from the browser
    if (typeof navigator === 'undefined') return null;
    const userLanguages = navigator.languages;
    for (const userLang of userLanguages) {
        const match = supportedLanguages.find(lang => lang.code === userLang);
        if (match) {
            return match.code;
        }

        // check for base language match (e.g., 'en' in 'en-US')
        if (userLang.indexOf('-') > -1) {
            const baseLang = userLang.split('-')[0];
            const baseMatch = supportedLanguages.find(lang => lang.code === baseLang);
            if (baseMatch) {
                return baseMatch.code;
            }
        }
    }

    return null;
}


export const I18NextContext: Component<I18NextContextProps> = (props) => {

    const [currentLanguage, setCurrentLanguage] = createSignal<string | null>(null);

    const i18nextInitPromise = new Promise<void>((resolve) => {
        const _observer = () => {
            i18next.off('initialized', _observer);
            resolve();
        }
        i18next.on('initialized', _observer);
    });

    // TODO: REMOVE THIS STORE WHEN POSSIBLE. WE ONLY NEED THE SIGNAL.
    const [loadedStore, setLoadedStore] = createStore<LoadedResources>({});
    const [loadedSignal, setLoadedSignal] = createSignal<LoadedResources>({});

    const languageChangedObserver = (langCode: string) => {
        setCurrentLanguage(langCode);
    }

    const resourceLoadedObserver = (info: LoadedResources) => {
        for (const langCode in info) {
            if (!(langCode in loadedStore)) {
                setLoadedStore(langCode, info[langCode]!);
            } else {
                for (const ns in info[langCode]) {
                    setLoadedStore(langCode, ns, info[langCode][ns] as boolean);
                }
            }
        }
        setLoadedSignal({ ...unwrap(loadedStore) } as LoadedResources);
    }

    const [info] = createResource(async () => {
        const response = await fetch(`${props.host || 'https://api.apiglot.com'}/v1/${props.projectId}/info`, {
            headers: {
                'Authorization': `Bearer ${props.apiKey}`
            }
        });
        const _json = await response.json();
        return _json as ProjectInfo;
    });

    const languages = createMemo(() => {
        const _projectInfo = info();
        if (!_projectInfo) return [];
        return [_projectInfo.sourceLanguage, ..._projectInfo.targetLanguages];
    });

    const changeLanguage = async (langCode: string) => {
        await i18nextInitPromise;
        await i18next.changeLanguage(langCode);
    }

    const loadNamespace = async (ns: string | string[]) => {
        await i18nextInitPromise;
        await i18next.loadNamespaces(ns);
    };

    const loadRawJson = async (langCode: string, ns: string) => {
        if (!i18next.hasResourceBundle(langCode, ns)) {
            await i18next.reloadResources(langCode, ns);
        }
        return i18next.getResourceBundle(langCode, ns) as Record<string, any>;
    }

    createEffect(() => {
        const _projectInfo = info();
        if (!_projectInfo) return;

        const options = {
            debug: props.debug,
            lng: getInitialLanguage(_projectInfo.targetLanguages) || _projectInfo.sourceLanguage.code || 'en',
            supportedLngs: [_projectInfo.sourceLanguage.code].concat(_projectInfo.targetLanguages.map(lang => lang.code)),
            fallbackLng: 'en',
            ns: _projectInfo.namespaces[0] || 'common', // TODO: this could be an array of namespaces, configured in Apiglot
            //defaultNS: _projectInfo.namespaces[0] || 'common',
            backend: {
                withCredentials: true,
                loadPath: `${props.host || 'https://api.apiglot.com'}/v1/${props.projectId}/{{lng}}/{{ns}}`,
                customHeaders: {
                    'Authorization': `Bearer ${props.apiKey}`
                },
                crossDomain: true
            }
        }

        i18next.use(HttpApi).init(options);
    });

    onMount(() => {
        i18next.on('loaded', resourceLoadedObserver);
        i18next.on('languageChanged', languageChangedObserver);
    });

    onCleanup(() => {
        i18next.off('loaded', resourceLoadedObserver);
        i18next.off('languageChanged', languageChangedObserver);
    });

    const contextValue: I18NextContext = {
        languages,
        currentLanguage,
        changeLanguage,
        loadNamespace,
        loadRawJson,
        loading: () => info.loading,
        loadedSignal,
        i18next,
    };

    return (
        <Context.Provider value={contextValue}>
            {props.children}
        </Context.Provider>
    )
}

export const useI18Next = () => useContext(Context);

export const useTranslation = (namespace: string | string[] | undefined = undefined) => {
    const context = useContext(Context);

    if (!context) {
        throw new Error('useTranslation must be used within an I18NextContext.Provider');
    }

    if (namespace) {
        context.loadNamespace(namespace);
    }

    const areResourcesLoaded = () => {
        const curLang = context.currentLanguage();
        const loaded = context.loadedSignal();

        if (!curLang || !(curLang in loaded)) {
            return false;
        }

        if (Array.isArray(namespace)) {
            return namespace.every(ns => ns in loaded[curLang]!);
        } else if (typeof namespace === 'string') {
            return namespace in loaded[curLang]!;
        }

        return true;
    }

    return {
        t: (key: string, options?: any) => {

            const allResourcesAvailable = areResourcesLoaded()

            // access the resource to create reactivity
            if (!allResourcesAvailable) {
                return (
                    typeof options === "string"
                        ? options
                        : key
                );
            }

            const _options = { ns: namespace } as any;
            if (typeof options === "string") {
                _options['defaultValue'] = options;
            } else if (typeof options === "object" && options !== null) {
                Object.assign(_options, options);
            }


            return context.i18next.t(key, _options) as string;
        },
    }
}

export type LanguagePickerProps = JSX.InputHTMLAttributes<HTMLSelectElement>

export const LanguageSwitch: Component<LanguagePickerProps> = (props) => {
    const i18nContext = useI18Next();

    const handleChange = (e: Event) => {
        const langCode = (e.target as HTMLSelectElement).value;
        if (i18nContext) {
            i18nContext.changeLanguage(langCode);
        }
    }

    const options = createMemo(() => (i18nContext?.languages() ?? []).map(lang => ({
        value: lang.code,
        label: lang.name
    })));

    return (
        <select {...props} onChange={handleChange}>
            <For each={options()}>{(option) => (
                <option value={option.value} selected={i18nContext?.currentLanguage() === option.value}>{option.label}</option>
            )}</For>
        </select>
    )
}

export type TranslateableProps = ParentProps<{
    key: string
    namespace?: string | string[]
    placeholders?: Record<string, any>

    /**
     * Allows HTML tags in the translation string to be rendered as HTML.  Default is false.
     */
    renderHtml?: boolean
}>

export const Translateable: Component<TranslateableProps> = (props) => {
    const { t } = useTranslation(props.namespace);
    let spanRef: HTMLSpanElement | undefined;

    const translation = createMemo(() => t(props.key, {
        ...(props.placeholders || {}),
        escapeValue: !props.renderHtml,
    }));

    createEffect(() => {
        const _translation = translation();
        if (props.renderHtml && /<\/?[a-z][\s\S]*>/i.test(_translation) && spanRef) {
            spanRef.innerHTML = _translation;
        } else if (spanRef) {
            spanRef.textContent = _translation;
        }
    });

    return <span ref={spanRef}>{translation()}</span>;
}
