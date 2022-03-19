
// custom layer for tensorflow
class BilinearUpSampling2D extends tf.layers.Layer{
    constructor(config){
        super(config);
        this.size = config.size;
        this.dataFormat = config.dataFormat;
        this.interpolation = 'bilinear';
        //console.log(config);
        //console.log(this);
    }
    build(inputShape){
        //no weights, so nothing to be done
    }
    call(input){
        return tf.layers.upSampling2d(this).apply(input);
    }
    getConfig(){
        const config = super.getConfig();
        Object.assign(config, {size: this.size, dataFormat: this.dataFormat});
        return config;
    }
    static get className(){
        return 'BilinearUpSampling2D';
    }
}

tf.serialization.registerClass(BilinearUpSampling2D);