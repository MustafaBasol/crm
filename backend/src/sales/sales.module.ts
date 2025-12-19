import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './entities/sale.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { Quote } from '../quotes/entities/quote.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, Customer, Product, ProductCategory, Quote]),
  ],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
