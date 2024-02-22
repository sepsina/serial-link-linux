import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule} from '@angular/forms';
import { AngularMaterialModule } from './angular-material/angular-material.module';

import { HTU21D_005_Component } from './htu21d-005/htu21d-005.component';
import { SHT40_018_Component } from './sht40-018/sht40-018.component';
import { SH_006_Component } from './sh-006/sh-006.component';
import { BME280_007_Component } from './bme280-007/bme280-007.component';
import { SSR_009_Component } from './ssr-009/ssr-009.component';
import { Actuator_010_Component } from './actuator-010/actuator-010.component';
import { DBL_SW_008_Component } from './dbl-sw-008/dbl-sw-008.component';
import { TGL_SW_011_Component } from './tgl-sw-011/tgl-sw-011';
import { RKR_SW_012_Component } from './rkr-sw-012/rkr-sw-012';
import { ZB_Bridge_Component } from './zb-bridge/zb-bridge.component';
import { Esp_Link_Component } from './esp-link/esp-link.component';
import { AQ_015_Component} from './aq-015/aq-015.component';
import { SI7021_027_Component } from './si7021-027/SI7021-027.component';
import { PB_SW_023_Component } from './pb-sw-023/pb-sw-023';

import { SliderModule } from 'primeng/slider'

@NgModule({
    declarations: [
        AppComponent,
        HTU21D_005_Component,
        SHT40_018_Component,
        SH_006_Component,
        BME280_007_Component,
        SSR_009_Component,
        Actuator_010_Component,
        DBL_SW_008_Component,
        TGL_SW_011_Component,
        RKR_SW_012_Component,
        ZB_Bridge_Component,
        Esp_Link_Component,
        AQ_015_Component,
        SI7021_027_Component,
        PB_SW_023_Component
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        AngularMaterialModule,
        SliderModule
    ],
    providers: [],
    bootstrap: [AppComponent],
    entryComponents:[
        // ---
    ]
})
export class AppModule {
}
