const APP_VERSION = '1.6.0';
const APP_VERSION_PREVIOUS = '1.5.0';

const IMGUR_API_URL = 'https://api.imgur.com/3/image';
import { CLIENT_ID } from './imgur.config.js'; // Imgur API token

import libAsync from 'async-es';
import numeral from 'numeral';
import debounce from './helpers/debounce';

import CameraRollScene from './components/scenes/CameraRollScene';
import HomeScene from './components/scenes/Home';
import InitializingScene from './components/scenes/Initializing';
import UploadScene from './components/scenes/Upload';
import HistoryScene from './components/scenes/History';
import SettingsScene from './components/scenes/Settings';

import React, {
    Alert,
    AppRegistry,
    AsyncStorage,
    BackAndroid,
    CameraRoll,
    Clipboard,
    Component,
    Dimensions,
    Linking,
    ListView,
    Navigator,
    ProgressBarAndroid as ProgressBar,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid as Toast,
    TouchableHighlight,
    TouchableOpacity,
    View
} from 'react-native';

import {
    MKButton,
    MKCheckbox,
    MKColor,
    MKTextField,
} from 'react-native-material-kit';

import {
    Card,
    CheckboxGroup,
    RadioButtonGroup,
    Subheader,
    Toolbar,
} from 'react-native-material-design';

import DIC from './dictionary.config.js';

import Share from 'react-native-share';

import RNFS from 'react-native-fs';
import FileTransfer from '@remobile/react-native-file-transfer';
import {
    ImagePickerManager,
    RNFileIntent,
 } from 'NativeModules';

import IconEI from 'react-native-vector-icons/EvilIcons';
import IconFA from 'react-native-vector-icons/FontAwesome';

const loadingGif = require('./Ajax-loader.gif');
const STORAGE_KEY = '@Minimgur:state';
const WINDOW_HEIGHT = Dimensions.get('window').height;
const RENDER_RANGE = Dimensions.get('window').height * 6;
const PARALLEL_UPLOAD_SESSIONS_LIMIT = 3;

export default class minimgur extends Component {
    constructor(props) {
        super(props);
        // use previous version to trigger notification in renderScene()
        this.state = {
          version: APP_VERSION_PREVIOUS,
        };
    }

    componentDidMount() {
        BackAndroid.addEventListener('hardwareBackPress', () => {
            const currentRouteName = this.refs.navigator.getCurrentRoutes().slice(-1)[0].name;
            switch (currentRouteName) {
                case 'home':
                    BackAndroid.exitApp();
                    break;
                case 'results':
                    this.refs.navigator.resetTo({name: 'home'});
                    break;
                case 'uploading':
                    break;
                default:
                    this.refs.navigator.pop();
            }
            return true;
        });
        RNFileIntent.getReceivedFile((response) => this.handleIncomingIntent(response));
    }

    handleIncomingIntent(response) {
        if (Array.isArray(response) && response.length !== 0) {
            this.loadInitialState(() => {
                this.uploadMultipleImages(response);
            });
        } else {
            this.loadInitialState(() => {
                this.refs.navigator.resetTo({name: 'home'});
            });
        }
    }

    loadInitialState(callback) {
        this.loadState((state) => {
            if (err) {
                throw err;
            }
            if (state !== null) {
                this.setState(JSON.parse(state)), () => {
                    if (this.state.options.displayLanguage && this.state.options.displayLanguage !== 'default') {
                        DIC.setLanguage(this.state.options.displayLanguage);
                    }
                    callback();
                });
            } else {
                // the state on clean start
                this.setState({
                    options: {
                        autoCopyOnUploadSuccess: true,
                        useMimeTypeIntentSelector: false,
                        displayLanguage: 'default',
                    },
                    results: [],
                    history: [],
                }), callback);
            }
        });
    }

    loadState(callback) {
        AsyncStorage.getItem(STORAGE_KEY, (err, state) => {
            if (err) {
                throw err;
            }
            if (callback) callback(state);
        });
    }

    saveState(callback) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state), (err) => {
            if (err) {
                throw err;
            }
            if (callback) callback();
        });
    }

    setOptions = (newOptions, callback) => {
        this.setState({
            options: Object.assign(
                {},
                this.state.options,
                newOptions
            ),
        }, () => {
            this.saveState(callback);
        });
    }

    setUILanguage = (language) => {
        if (language === 'default') {
            DIC.setLanguage(DIC.getInterfaceLanguage());
        } else {
            DIC.setLanguage(language);
        }
        this.forceUpdate();
    }

    render() {
        return (
            <Navigator
                ref="navigator"
                initialRoute={{name: 'initializing'}}
                configureScene={(route, routeStack) => Navigator.SceneConfigs.FloatFromBottomAndroid}
                renderScene={this.renderScene}
                navigationBar={(() => {
                    if (!this.state.fullScreen) {
                        return (
                            <Toolbar
                                title="Minimgur"
                                primary="paperTeal"
                                icon="home"
                                onIconPress={() => {
                                    this.refs.navigator.resetTo({name: 'home'});
                                }}
                                actions={[{
                                    icon: 'settings',
                                    onPress: () => {
                                        const currentRouteName = this.refs.navigator.getCurrentRoutes().slice(-1)[0].name;
                                        if ( currentRouteName !== 'uploading' &&
                                            currentRouteName !== 'settings' ) {
                                            this.refs.navigator.push({ name: 'settings' });
                                        }
                                    }
                                }]}
                                rightIconStyle={{
                                    margin: 16
                                }}
                            />
                        )
                    }
                })()}
            />
        );
    }

    renderScene = (route, navigator) => {
        // show app version update announcement
        if (this.state.version !== APP_VERSION && route.name !== 'initializing') {
            Alert.alert(
                DIC.newFeature,
                DIC.newFeatureDescription,
                [{
                    text: DIC.ok,
                    onPress: () => {
                        this.setState({
                            version: APP_VERSION_PREVIOUS //current version
                        }), this.saveState);
                    }
                }]
            );
        }
        switch (route.name) {
            case 'initializing':
                return (
                    <InitializingScene />
                );
            case 'home':
                return (
                    <HomeScene
                        pushNavigator={deboune(() => {
                            navigator.push(route);
                        })}
                        getImageFromCamera={this.getImageFromCamera}
                        getImagesFromLibrary={this.getImagesFromLibrary}
                    />
                );
            case 'settings':
                return (
                    <SettingsScene
                        options={this.state.options}
                        setOptions={this.setOptions}
                        setUILanguage={this.setUILanguage}
                        clearHistory={() => {
                            navigator.push({ name: 'initializing'});
                            this.setState({
                                results: [],
                                history: [],
                            }), () => {
                                this.saveState(() => {
                                    Toast.show(DIC.clearedLocalHistory, Toast.SHORT);
                                    navigator.pop();
                                });
                            });
                        }}
                    />
                );
            case 'cameraRoll':
                return (
                    <CameraRollScene
                        onUpload={(imageURIs) =>{
                            if (imageURIs.length === 0) {
                                Toast.show(DIC.selectAtLeastOneImageToUpload, Toast.SHORT);
                                return;
                            }
                            this.uploadMultipleImages(
                                imageURIs.map((uri) => (
                                    {
                                        uri,
                                        fileName: '',
                                    }
                                ))
                            );
                        }}
                    />
                );
            case 'uploading':
                return (
                    <UploadScene
                        filename={route.fileName}
                        uploadProgress={this.state.uploadProgress}
                        uploadProgressTotal={this.state.uploadProgressTotal}
                        uploadFilesCount={this.route.uploadFilesCount}
                        uploadFilesTotal={this.route.uploadFilesTotal}
                    />
                );
            case 'results':
                return (
                    <HistoryScene
                        history={this.state.results}
                        asResultsScene={true}
                    />
                );
            case 'history':
                return (
                    <HistoryScene
                        history={this.state.history}
                        deleteImage={this.deleteImage}
                    />
                );
            case 'showImage':
                const { width, height } = Dimensions.get('window');
                return (
                    <View>
                        <XImage url={route.url} style={{ height, width }} />
                    </View>
                );
        }
    };

    getImagesFromLibrary = () => {
        this.setState({
            results: [],
        }, () => {
            if (this.state.options.useMimeTypeIntentSelector) {
                RNFileIntent.requestFile("image/*", (response) => {
                    if (!response.didCancel) {
                        this.uploadMultipleImages([response]);
                    }
                });
            } else {
                ImagePickerManager.launchImageLibrary({}, (response) => {
                    if (!response.didCancel) {
                      this.uploadMultipleImages([response]);
                    }
                });
            }
        });
    }

    getImageFromCamera = () => {
        this.setState({
            results: [],
        }, () => {
            ImagePickerManager.launchCamera({mediaType: 'photo'}, (response) => {
                if (!response.didCancel) {
                    this.uploadMultipleImages([response]);
                }
            });
        });
    }

    uploadMultipleImages = (images) => {
        this.setState({
            uploadProgress: 0,
            uploadProgressTotal: 0,
        }, () => {
            libAsync.mapLimit(images, 10, (image, resolve) => {
                if (typeof image.fileSize !== 'undefined') {
                    image.fileSize = parseInt(image.fileSize);
                    resolve(null, image);
                } else {
                    RNFileIntent.queryFileStat(image.uri, (response) => {
                        response.fileSize = parseInt(response.fileSize);
                        resolve(null, response);
                    });
                }
            }, (err, images) => {
                images = images.map((image, i) => {
                    return {
                        ...image,
                        order: i,
                    };
                });
                this.setState({
                    uploadProgressTotal: images.reduce( (prev, curr) => {
                        return prev + curr.fileSize;
                    }, 0),
                }, () => {
                    const progress = new Array(images.length).fill(0);
                    const total = images.length;
                    let current = 0;
                    this.refs.navigator.replace({
                        name: 'uploading',
                        uploadFilesCount: current,
                        uploadFilesTotal: total,
                        fileName: false,
                    });
                    libAsync.mapLimit(images, PARALLEL_UPLOAD_SESSIONS_LIMIT, (image, resolve) => {
                        const fileTransfer = new FileTransfer();
                        fileTransfer.onprogress = (progressEvent) => {
                            progress[image.order] = progressEvent.loaded;
                            const newProgress = progress.reduce((prev, curr) => prev + curr);
                            this.setState({
                                uploadProgress: (newProgress < this.state.uploadProgressTotal ? newProgress : this.state.uploadProgressTotal),
                            });
                        };
                        fileTransfer.upload(image.uri, IMGUR_API_URL,
                            (result) => {
                                response = JSON.parse(result.response);
                                current += 1;
                                this.refs.navigator.replace({
                                    name: 'uploading',
                                    uploadFilesCount: current,
                                    uploadFilesTotal: total,
                                    fileName: false,
                                });
                                if (response.success) {
                                const result = {
                                deletehash: response.data.deletehash,
                                id: response.data.id,
                                link: response.data.link.replace('http://', 'https://'),
                                };
                                resolve(null, result);
                                } else {
                                Toast.show(DIC.failedToUploadSelectedImage, Toast.SHORT);
                                // handle occured error in main callback instead of mapLimit itself,
                                // otherwise mapLimit will immediately ignore rest pending async actions and call the main callback.
                                resolve(null, false);
                                }
                            },
                            // fileTransfer() error handle
                            (err) => {
                                progress[image.order] = image.fileSize;
                                this.setState({
                                    uploadProgress: progress.reduce((prev, curr) => prev + curr)
                                });
                                Toast.show(DIC.failedToUploadSelectedImage, Toast.SHORT);
                                // handle occured error in main callback instead of mapLimit itself,
                                // otherwise mapLimit will immediately ignore rest pending async actions and call the main callback.
                                resolve(null, false);
                            },
                            // fileTransfer() options
                            {
                                fileKey: 'image',
                                fileName: image.fileName || 'tempFileName',
                                mimeType: image.type,
                                headers: {
                                    Authorization: 'Client-ID ' + CLIENT_ID
                                },
                            }
                        );
                    }, (err, results) => {
                        // filter failed requests
                        const filteredResults = results.filter((result) => result);
                        if (filteredResults.length === 0) {
                            Toast.show(DIC.allUploadActionsAreFailed, Toast.SHORT);
                            this.refs.navigator.resetTo({name: 'home'});
                        } else {
                            this.setState({
                                results: filteredResults,
                                history: filteredResults.concat(this.state.history),
                            }), () => {
                                this.saveState(() => {
                                    this.refs.navigator.push({name: 'results'});
                                    if (this.state.options.autoCopyOnUploadSuccess) {
                                        this.copyResultsToClipboard(results.map((image) => image.link));
                                    }
                                    if (results.length !== filteredResults.length) {
                                        Toast.show( (results.length - filteredResults.length) + ' ' + DIC.numUploadActionsAreFailed, Toast.SHORT);
                                    }
                                });
                            });
                        }
                    });
                });
            });
        });
    }

    deleteImage = (image) => {
        Toast.show(DIC.deletingRemoteImage + image.link, Toast.SHORT);
        fetch(`${IMGUR_API_URL}/${image.deletehash}`, {
            method: 'DELETE',
            headers: {
                Authorization: 'Client-ID ' + CLIENT_ID
            },
        })
            .then((response) => response.json())
            .then((response) => {
                if (response.success) {
                    this.setState(Object.assign({}, this.state, {
                        history: this.state.history.filter((historyImage) => {
                            return historyImage.deletehash !== image.deletehash;
                        })
                    }), this.saveState);
                }
                // TODO: error handle
            })
            .catch((e) => console.error(e));
    }
}
